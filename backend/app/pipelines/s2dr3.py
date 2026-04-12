"""
S2DR3 Pipeline Service
Handles phased imagery acquisition and spectral index processing.
"""
import asyncio
import os
import httpx
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from PIL import Image
from typing import Optional, Dict, Any

from app.core.config import S2DR3_BASE_URL, S2DR3_USER_ID, DATA_DIR
from app.utils.subprocess import safe_run_subprocess
from app.services.legend import INDEX_LEGEND
from app.core.logger import get_logger

logger = get_logger("app.pipelines.s2dr3")

# Global lock to prevent gcloud collisions
GCLOUD_LOCK = asyncio.Lock()

def percentile_normalize(arr: np.ndarray, lo=2.0, hi=98.0) -> np.ndarray:
    valid = arr[np.isfinite(arr)]
    if valid.size == 0:
        return np.zeros_like(arr)
    lo_v, hi_v = np.percentile(valid, lo), np.percentile(valid, hi)
    if (hi_v - lo_v) < 1e-10:
        return np.zeros_like(arr)
    return np.clip((arr - lo_v) / (hi_v - lo_v), 0.0, 1.0)

def save_index_png(arr: np.ndarray, filename: str, cmap_name: str):
    clean = arr.copy().astype(np.float32)
    clean[~np.isfinite(clean)] = np.nan
    norm = percentile_normalize(clean)
    colored = plt.get_cmap(cmap_name)(norm)
    if np.any(~np.isfinite(clean)):
        colored[~np.isfinite(clean), 3] = 0.0
    plt.imsave(filename, colored)

def compute_stats(arr: np.ndarray) -> dict:
    valid = arr[np.isfinite(arr)]
    if valid.size == 0:
        return {"min": 0.0, "max": 0.0, "mean": 0.0, "std": 0.0}
    return {
        "min": float(valid.min()),
        "max": float(valid.max()),
        "mean": float(valid.mean()),
        "std": float(valid.std()),
    }

def generate_indices(ms_path: str, output_dir: str, label: str) -> Dict[str, Any]:
    """Compute all spectral indices from MS TIF using User-defined formulas."""
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f"[{label}] Deep Spectral Analysis started: {ms_path}")
    
    with rasterio.open(ms_path) as src:
        # Sentinel-2 B02=10m, B03=10m, B04=10m, B08=10m, B11=20m (rescaled)
        # S2DR3 usually provides them stacked.
        data = src.read().astype(np.float32) / 10000.0

    # Band indices based on S2DR3 10-band order:
    # 0=B02, 1=B03, 2=B04, 3=B05, 4=B06, 5=B07, 6=B08, 7=B8A, 8=B11, 9=B12
    b02, b03, b04, b08, b11 = data[0], data[1], data[2], data[6], data[8]
    eps = 1e-10

    results = {
        "NDVI":  (b08 - b04) / (b08 + b04 + eps),
        "NDBI":  (b11 - b08) / (b11 + b08 + eps),
        "NDWI":  (b03 - b08) / (b03 + b08 + eps),
        "MNDWI": (b03 - b11) / (b03 + b11 + eps),
        "BSI":   ((b11 + b04) - (b08 + b02)) / ((b11 + b04) + (b08 + b02) + eps),
        "EVI":   np.clip(2.5 * (b08 - b04) / (b08 + 6.0 * b04 - 7.5 * b02 + 1.0 + eps), -1.5, 1.5),
    }

    generated = {}
    for name, array in results.items():
        meta = INDEX_LEGEND.get(name, {"cmap": "viridis"})
        out_path = os.path.join(output_dir, f"{label.lower()}_{name}.png")
        save_index_png(array, out_path, meta["cmap"])
        generated[name] = {
            "path": out_path,
            "stats": compute_stats(array),
            "meta": meta
        }
    return generated

async def submit_and_poll(client: httpx.AsyncClient, date: str, aoi: str, label: str, source: str = "s2dr3") -> Optional[dict]:
    """Submit job and poll until complete with safety limits."""
    logger.info(f">>> [I/O] [{source.upper()}] {label} Submitting Job: {date}...")
    try:
        resp = await client.post(
            f"{S2DR3_BASE_URL}/{S2DR3_USER_ID}",
            json={"date": date, "aoi": aoi, "source": source},
            timeout=30.0,
        )
        if resp.status_code != 200:
            logger.error(f">>> [I/O] [{source.upper()}] {label} Submission Failed: {resp.status_code}")
            return None

        data = resp.json()
        job_id = data.get("job_id")
        if not job_id: 
            logger.error(f">>> [I/O] {label} Missing Job ID.")
            return None

        logger.info(f">>> [I/O] {label} Job {job_id} Active. Polling...")
        check_url = f"{S2DR3_BASE_URL}/{S2DR3_USER_ID}/{job_id}"

        # Safety: Max 50 polls (approx 3 mins)
        for attempt in range(50):
            try:
                r = await client.get(check_url, timeout=10.0)
                text = r.text.lower()
                if "completed" in text:
                    logger.info(f">>> [I/O] {label} Remote Work Done.")
                    return {"tci": data.get("save_path_TCI"), "ms": data.get("save_path_MS"), "label": label, "date": date}
                elif "failed" in text or "error" in text:
                    logger.error(f">>> [I/O] {label} Remote Error: {r.text}")
                    return None
            except Exception as e:
                logger.error(f">>> [I/O] {label} Poll Attempt {attempt} Error: {e}")
            
            await asyncio.sleep(4)
        
        logger.error(f">>> [I/O] {label} Polling Timeout.")
        return None
    except Exception as e:
        logger.error(f">>> [I/O] {label} Submission Error: {e}")
        return None

async def download_one(remote: str, local: str, on_progress=None) -> bool:
    async with GCLOUD_LOCK:
        if os.path.exists(local): os.remove(local)
        cmd = f'gcloud storage cp "{remote}" "{local}"'
        return await safe_run_subprocess(cmd, on_progress=on_progress)

async def execute_tci_phase(
    date: str,
    aoi: str,
    label: str,
    project_id: int,
    source: str = "s2dr3",
    on_progress=None
) -> Optional[dict]:
    """Phase 1: Fetch TCI and ready it for UI/Change Detection."""
    project_dir = os.path.join(DATA_DIR, str(project_id))
    label_dir = os.path.join(project_dir, label.lower())
    os.makedirs(label_dir, exist_ok=True)

    async with httpx.AsyncClient() as client:
        result = await submit_and_poll(client, date, aoi, label, source=source)
    
    if not result: return None

    local_tci_tif = os.path.join(label_dir, "tci.tif")
    local_tci_png = os.path.join(label_dir, "tci.png")

    logger.info(f"[{label}] Syncing TCI phase...")
    if await download_one(result["tci"], local_tci_tif, on_progress):
        try:
            with rasterio.open(local_tci_tif) as src:
                data = src.read([1, 2, 3])
                if data.max() > 255:
                    data = np.clip(data / 10000.0 * 255.0, 0, 255).astype(np.uint8)
                else:
                    data = data.astype(np.uint8)
                Image.fromarray(np.transpose(data, (1, 2, 0))).save(local_tci_png, "PNG")
            result["png_tci"] = local_tci_png
            return result
        except Exception as e:
            logger.error(f"[{label}] TCI Conversion error: {e}")
    return None

async def execute_ms_phase(
    result: dict,
    project_id: int,
    source: str = "s2dr3",
    on_progress=None
) -> Optional[dict]:
    """Phase 2: Fetch MS and process Spectral Intel."""
    label = result["label"]
    project_dir = os.path.join(DATA_DIR, str(project_id))
    label_dir = os.path.join(project_dir, label.lower())
    local_ms_tif = os.path.join(label_dir, "ms.tif")

    logger.info(f"[{label}] Syncing MS phase (Spectral Intel)...")
    if await download_one(result["ms"], local_ms_tif, on_progress):
        indices = generate_indices(local_ms_tif, label_dir, label)
        result["indices"] = indices
        result["ms_path"] = local_ms_tif
        return result
    return None

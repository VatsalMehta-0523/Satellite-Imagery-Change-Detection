"""
Planet Labs Pipeline Service
Handles Search, Activate, Order, and Spectral extraction for PSScene 8-band SR.
"""
import asyncio
import os
import httpx
import numpy as np
import rasterio
import logging
from PIL import Image
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from app.core.config import DATA_DIR, PL_API_KEY
from app.utils.subprocess import safe_run_subprocess

logger = logging.getLogger(__name__)

# Constants
PLANET_DATA_URL = "https://api.planet.com/data/v1"
PLANET_ORDERS_URL = "https://api.planet.com/compute/ops/orders/v2"
ITEM_TYPE = "PSScene"
BUNDLE = "analytic_8b_sr_udm2"

# Index Configuration (Fixed Range as requested)
INDEX_CONFIG = {
    "NDVI": {"cmap": "RdYlGn", "vmin": -0.2, "vmax": 0.8},
    "EVI":  {"cmap": "RdYlGn", "vmin": -0.2, "vmax": 0.6},
    "NDWI": {"cmap": "RdYlBu", "vmin": -0.5, "vmax": 0.5},
    "NDRE": {"cmap": "RdYlGn", "vmin": -0.1, "vmax": 0.7},
}

def _fixed_normalize(arr: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    return np.clip((arr - vmin) / (vmax - vmin), 0.0, 1.0)

def _bbox_to_polygon(bbox_str: str) -> dict:
    minx, miny, maxx, maxy = map(float, bbox_str.split())
    return {
        "type": "Polygon",
        "coordinates": [[
            [minx, miny], [maxx, miny], [maxx, maxy],
            [minx, maxy], [minx, miny],
        ]],
    }

async def execute_planet_tci_phase(
    date_str: str,
    aoi_bbox: str,
    label: str,
    project_id: int,
    on_progress=None
) -> Optional[dict]:
    """Phase 1: Search, Activate, Order, and Download TCI."""
    if not PL_API_KEY:
        logger.error("Planet API Key not configured.")
        return None

    project_dir = os.path.join(DATA_DIR, str(project_id))
    label_dir = os.path.join(project_dir, label.lower())
    os.makedirs(label_dir, exist_ok=True)
    
    auth = (PL_API_KEY, "")
    
    async with httpx.AsyncClient(auth=auth, timeout=60.0) as client:
        # 1. Search (±3 days)
        if on_progress: on_progress(10)
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        gte = (dt - timedelta(days=3)).strftime("%Y-%m-%dT00:00:00Z")
        lte = (dt + timedelta(days=3)).strftime("%Y-%m-%dT23:59:59Z")
        
        search_body = {
            "item_types": [ITEM_TYPE],
            "filter": {
                "type": "AndFilter",
                "config": [
                    {"type": "DateRangeFilter", "field_name": "acquired", "config": {"gte": gte, "lte": lte}},
                    {"type": "GeometryFilter", "field_name": "geometry", "config": _bbox_to_polygon(aoi_bbox)},
                    {"type": "RangeFilter", "field_name": "cloud_cover", "config": {"gte": 0, "lte": 0.20}},
                    {"type": "AssetFilter", "config": ["ortho_analytic_8b_sr"]},
                ],
            },
        }
        
        resp = await client.post(f"{PLANET_DATA_URL}/quick-search", json=search_body)
        if resp.status_code != 200:
            logger.error(f"Planet Search Failed: {resp.status_code}")
            return None
        
        features = resp.json().get("features", [])
        if not features: 
            logger.error(f"No Planet imagery found for {date_str}")
            return None
        
        best = sorted(features, key=lambda f: f["properties"].get("cloud_cover", 1))[0]
        item_id = best["id"]
        
        # 2. Activation
        if on_progress: on_progress(25)
        assets_url = f"{PLANET_DATA_URL}/item-types/{ITEM_TYPE}/items/{item_id}/assets"
        assets_resp = await client.get(assets_url)
        assets = assets_resp.json()
        asset = assets.get("ortho_analytic_8b_sr")
        
        if not asset:
            logger.error(f"Asset ortho_analytic_8b_sr not found for item {item_id}")
            return None

        if asset.get("status") != "active":
            activate_link = asset.get("_links", {}).get("activate")
            if not activate_link:
                logger.error(f"Activation link missing for asset {item_id}")
                return None
            await client.get(activate_link)
            # Poll activation
            for _ in range(40): # 10 mins approx
                await asyncio.sleep(15)
                status = (await client.get(assets_url)).json()
                if status.get("ortho_analytic_8b_sr", {}).get("status") == "active":
                    break
        
        # 3. Place Order (Clipped)
        if on_progress: on_progress(50)
        minx, miny, maxx, maxy = map(float, aoi_bbox.split())
        order_body = {
            "name": f"urbaneye_{project_id}_{label}_{item_id[:8]}",
            "source_type": "scenes",
            "products": [{"item_ids": [item_id], "item_type": ITEM_TYPE, "product_bundle": BUNDLE}],
            "tools": [{"clip": {"aoi": _bbox_to_polygon(aoi_bbox)}}]
        }
        
        # Note: Orders API uses API key in header differently or same auth
        order_resp = await client.post(PLANET_ORDERS_URL, json=order_body)
        if order_resp.status_code not in (200, 202):
            logger.error(f"Planet Order failed: {order_resp.text}")
            return None
        
        order_id = order_resp.json().get("id")
        
        # 4. Poll Order
        if on_progress: on_progress(70)
        for _ in range(60): # 15 mins approx
            await asyncio.sleep(15)
            ostatus = (await client.get(f"{PLANET_ORDERS_URL}/{order_id}")).json()
            if ostatus.get("state") == "success":
                break
            if ostatus.get("state") in ("failed", "cancelled"):
                return None
        
        # 5. Download
        if on_progress: on_progress(90)
        results = (await client.get(f"{PLANET_ORDERS_URL}/{order_id}")).json().get("_links", {}).get("results", [])
        tif_url = next((r["location"] for r in results if r.get("name", "").endswith(".tif") and ("SR" in r["name"] or "analytic_8b" in r["name"])), None)
        
        if not tif_url: return None
        
        local_tif = os.path.join(label_dir, "planet_sr.tif")
        local_png = os.path.join(label_dir, "tci.png")
        
        with open(local_tif, "wb") as f:
            async with client.stream("GET", tif_url) as r:
                async for chunk in r.aiter_bytes():
                    f.write(chunk)
                    
        # 6. Extract TCI (Planet Red=B6, Green=B4, Blue=B2)
        with rasterio.open(local_tif) as src:
            data = src.read([6, 4, 2]).astype(np.float32) / 10000.0
            # Quick boost for visualization
            data = np.clip(data * 3.5 * 255.0, 0, 255).astype(np.uint8)
            Image.fromarray(np.transpose(data, (1, 2, 0))).save(local_png, "PNG")
        
        if on_progress: on_progress(100)
        return {"png_tci": local_png, "tif_ms": local_tif, "label": label, "date": date_str}

async def execute_planet_ms_phase(
    result: dict,
    project_id: int
) -> Optional[dict]:
    """Phase 2: Compute Planet-specific Indices."""
    local_tif = result["tif_ms"]
    label = result["label"]
    project_dir = os.path.join(DATA_DIR, str(project_id))
    label_dir = os.path.join(project_dir, label.lower())
    
    with rasterio.open(local_tif) as src:
        # Band mapping (0-indexed): 1=Blue, 3=GreenII (B4), 5=Red (B6), 6=RedEdge (B7), 7=NIR (B8)
        data = src.read().astype(np.float32) / 10000.0
        
    eps = 1e-10
    blue = data[1] # B2
    grn  = data[3] # B4 (Green II)
    red  = data[5] # B6
    re   = data[6] # B7
    nir  = data[7] # B8
    
    indices = {}
    
    # 1. NDVI
    indices["NDVI"] = (nir - red) / (nir + red + eps)
    # 2. EVI
    evi_d = nir + 6.0 * red - 7.5 * blue + 1.0
    indices["EVI"] = np.clip(2.5 * (nir - red) / (evi_d + eps), -1.5, 1.5)
    # 3. NDWI
    indices["NDWI"] = (grn - nir) / (grn + nir + eps)
    # 4. NDRE (Planet Special)
    indices["NDRE"] = (nir - re) / (nir + re + eps)
    
    generated = {}
    for name, array in indices.items():
        cfg = INDEX_CONFIG[name]
        out_path = os.path.join(label_dir, f"{label.lower()}_{name}.png")
        
        clean = array.copy()
        clean[~np.isfinite(clean)] = np.nan
        norm = _fixed_normalize(clean, cfg["vmin"], cfg["vmax"])
        colored = plt.get_cmap(cfg["cmap"])(norm)
        colored[~np.isfinite(clean), 3] = 0.0
        plt.imsave(out_path, colored)
        
        valid = array[np.isfinite(array)]
        stats = {
            "min": float(valid.min()) if valid.size > 0 else 0,
            "max": float(valid.max()) if valid.size > 0 else 0,
            "mean": float(valid.mean()) if valid.size > 0 else 0,
            "std": float(valid.std()) if valid.size > 0 else 0
        }
        
        generated[name] = {
            "path": out_path,
            "stats": stats,
            "meta": {"cmap": cfg["cmap"]}
        }
        
    result["indices"] = generated
    return result

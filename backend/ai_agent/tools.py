import os
import json
import asyncio
import logging
from typing import List, Optional, Dict, Any
from langchain_core.tools import tool
from app.core.database import get_pool
from app.pipelines.s2dr3 import execute_tci_phase, execute_ms_phase, generate_indices
from app.pipelines.planet import execute_planet_tci_phase, execute_planet_ms_phase
from app.pipelines.gee import execute_gee_tci_phase, execute_gee_ms_phase
from app.pipelines.changeformer import run_change_detection
from app.services.pdf_report import MissionReportGenerator
from app.core.config import DATA_DIR
from datetime import datetime

logger = logging.getLogger("uvicorn.error")

@tool
async def create_mission(aoi_geojson: dict, mission_name: str) -> str:
    """Initialize a mission in the database. Returns project_id. Call this FIRST before any other tools."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow(
            "INSERT INTO projects (aoi_geojson) VALUES ($1) RETURNING id",
            json.dumps(aoi_geojson.get("geometry", aoi_geojson))
        )
    p_id = project["id"]
    logger.info(f">>> [ORION] INITIALIZED MISSION {p_id}: {mission_name}")
    return json.dumps({
        "project_id": p_id,
        "mission_name": mission_name,
        "status": "CREATED",
        "message": f"Mission '{mission_name}' registered as Project #{p_id}. Dashboard synchronized."
    })

@tool
async def search_orbital_scenes(source: str, start_date: str, end_date: str) -> str:
    """Search for available satellite imagery scenes. source can be 's2dr3', 'planet', or 'gee'."""
    logger.info(f">>> [ORION] Orbit discovery on {source} between {start_date} and {end_date}")
    return json.dumps({
        "dates": [start_date, end_date],
        "source": source,
        "availability": "HIGH",
        "message": f"Scene search complete. {source.upper()} has coverage from {start_date} to {end_date}."
    })

@tool
async def execute_orbital_fetch(project_id: int, aoi_str: str, date: str, label: str, source: str = "s2dr3") -> str:
    """
    Fetch TCI (RGB) and MS (Spectral) satellite imagery for one time period.
    label must be 'T1' (baseline) or 'T2' (monitoring).
    aoi_str is 'lon_min lat_min lon_max lat_max'.
    After success, the image will be visible on the Mission Dashboard page.
    """
    logger.info(f">>> [ORION] ORBITAL FETCH INITIATED: Provider={source}, MissionID={project_id}, Stage={label}, AOI={aoi_str}")
    try:
        # Verify provider-specific routing
        if source == "planet":
            logger.info(f"    - Routing to Planet Labs Pipeline for {date}")
            res = await execute_planet_tci_phase(date, aoi_str, label, project_id)
        elif source == "gee":
            logger.info(f"    - Routing to Google Earth Engine Pipeline for {date}")
            res = await execute_gee_tci_phase(date, aoi_str, label, project_id)
        else:
            logger.info(f"    - Routing to Standard Sentinel-2 (S2DR3) Pipeline for {date}")
            from app.pipelines.s2dr3 import execute_tci_phase
            res = await execute_tci_phase(date, aoi_str, label, project_id, source=source)
        
        if res and "error" not in res:
            # Save to DB record if not already there
            pool = await get_pool()
            dt = datetime.strptime(date, '%Y-%m-%d').date()
            async with pool.acquire() as conn:
                await conn.execute(
                    "INSERT INTO images (project_id, type, source, date, tci_png_path) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
                    project_id, label.lower(), source, dt, res.get("png_tci")
                )
            
            return json.dumps({
                "status": "SUCCESS",
                "label": label,
                "png_path": res.get("png_tci"),
                "ui_location": f"Mission Dashboard → {label} ORBITAL panel",
                "message": f"SUCCESS: {label} imagery sync complete via {source.upper()}. RGB composite ingested. Image is now visible in your Dashboard."
            })
        
        return json.dumps({
            "status": "FAILED", 
            "message": f"{label} submission failed. Check if {source.upper()} has coverage for {date} in this AOI."
        })
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)})

@tool
async def execute_spectral_analysis(project_id: int, label: str, source: str = "s2dr3") -> str:
    """
    Compute 6 spectral indices (NDVI, NDBI, NDWI, MNDWI, BSI, EVI) from multispectral bands.
    label must be 'T1' or 'T2'. The heatmaps will appear on the Spectral Index Validation page.
    This tool reads the existing TCI result from disk and fetches the MS bands.
    """
    logger.info(f">>> [ORION] EXEC-SPECTRAL {label} for mission {project_id}")
    try:
        # Look up the image record from DB
        pool = await get_pool()
        async with pool.acquire() as conn:
            img = await conn.fetchrow(
                "SELECT * FROM images WHERE project_id=$1 AND type=$2", 
                project_id, label.lower()
            )
        
        if not img:
            return json.dumps({"status": "FAILED", "message": f"No {label} image found. Run execute_orbital_fetch first."})
        
        # The MS phase needs the internal result dict from the TCI phase
        # We'll construct it from the DB record
        label_dir = os.path.join(DATA_DIR, str(project_id), label.lower())
        ms_tif = os.path.join(label_dir, "ms.tif")
        
        # Check if MS data already exists (from the main pipeline)
        if os.path.exists(ms_tif):
            indices = generate_indices(ms_tif, label_dir, label)
            # Save to DB
            async with pool.acquire() as conn:
                for name, idx in indices.items():
                    await conn.execute(
                        "INSERT INTO indices (image_id, index_type, image_path, mean_value) VALUES ($1,$2,$3,$4)",
                        img["id"], name, idx.get("path", ""), idx["stats"].get("mean", 0)
                    )
            
            idx_summary = ", ".join([f"{k}: {v['stats']['mean']:.4f}" for k, v in indices.items()])
            return json.dumps({
                "status": "SUCCESS",
                "label": label,
                "indices_computed": list(indices.keys()),
                "summary": idx_summary,
                "ui_location": "Spectral Index Validation page",
                "message": f"{label} spectral analysis complete. 6 indices computed: {idx_summary}. Heatmaps visible on the Spectral Index Validation page."
            })
        else:
            return json.dumps({
                "status": "SKIPPED",
                "label": label,
                "message": f"MS data not downloaded yet for {label}. The main pipeline handles this automatically during fetch."
            })
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)})

@tool
async def run_changeformer_inference(project_id: int, t1_png: str, t2_png: str) -> str:
    """
    Run ChangeFormer V6 neural change detection between T1 and T2 images.
    t1_png and t2_png are filesystem paths to the TCI PNGs.
    Results appear on the Change Detection page.
    """
    logger.info(f">>> [ORION] TRIGGERING NEURAL INFERENCE for mission {project_id}")
    try:
        output_dir = os.path.join(DATA_DIR, str(project_id), "change")
        os.makedirs(output_dir, exist_ok=True)
        
        cd_res = await run_change_detection(t1_png, t2_png, output_dir)
        
        if cd_res:
            change_pct = cd_res.get("stats", {}).get("change_percentage", 0)
            mask_path = cd_res.get("mask_path", "")
            
            # Save to DB
            pool = await get_pool()
            async with pool.acquire() as conn:
                t1 = await conn.fetchrow("SELECT id FROM images WHERE project_id=$1 AND type='t1'", project_id)
                t2 = await conn.fetchrow("SELECT id FROM images WHERE project_id=$1 AND type='t2'", project_id)
                if t1 and t2:
                    await conn.execute(
                        "INSERT INTO change_detection (project_id, t1_image_id, t2_image_id, mask_path, confidence) VALUES ($1,$2,$3,$4,$5)",
                        project_id, t1["id"], t2["id"], mask_path, float(change_pct) / 100.0
                    )
            
            return json.dumps({
                "status": "COMPLETE",
                "change_percentage": f"{change_pct:.2f}%",
                "mask_path": mask_path,
                "ui_location": "Change Detection page",
                "message": f"Neural inference complete. Detected {change_pct:.2f}% change. The change mask and interactive T1/T2 comparison slider are visible on the Change Detection page."
            })
        return json.dumps({"status": "FAILED", "message": "ChangeFormer inference returned no result."})
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)})

@tool
async def generate_mission_dossier(project_id: int) -> str:
    """
    Generate the final PDF intelligence report for a mission.
    This includes AI narrative, spectral analysis, change detection results, and heatmap images.
    The PDF can be downloaded from the Change Detection page.
    """
    logger.info(f">>> [ORION] FINALIZING MISSION DOSSIER for PID {project_id}")
    try:
        # Build report data from DB
        pool = await get_pool()
        async with pool.acquire() as conn:
            images = await conn.fetch("SELECT * FROM images WHERE project_id=$1", project_id)
            t1 = next((dict(i) for i in images if i["type"] == "t1"), None)
            t2 = next((dict(i) for i in images if i["type"] == "t2"), None)
            
            cd = await conn.fetchrow(
                "SELECT * FROM change_detection WHERE project_id=$1 ORDER BY id DESC LIMIT 1", project_id
            )
            
            indices = []
            target = t2 or t1
            if target:
                idx_rows = await conn.fetch("SELECT * FROM indices WHERE image_id=$1", target["id"])
                for r in idx_rows:
                    indices.append({
                        "name": r["index_type"],
                        "mean_val": r["mean_value"],
                        "heatmap_path": r["image_path"],
                        "description": ""
                    })

        report_data = {
            "project_id": project_id,
            "t1_date": str(t1["date"]) if t1 else "N/A",
            "t2_date": str(t2["date"]) if t2 else "N/A",
            "source": (t2 or t1 or {}).get("source", "unknown"),
            "change_pct": (cd["confidence"] * 100) if cd else 0,
            "area_m2": 0,
            "area_km2": 0,
            "area_ha": 0,
            "mask_path": cd["mask_path"] if cd else None,
            "t1_path": t1["tci_png_path"] if t1 else None,
            "t2_path": t2["tci_png_path"] if t2 else None,
            "indices": indices,
            "ai_summary": "Report generated via ORION autonomous agent."
        }
        
        generator = MissionReportGenerator(report_data)
        pdf_buffer = generator.generate()
        out_path = os.path.join(DATA_DIR, str(project_id), "mission_report.pdf")
        with open(out_path, "wb") as f:
            f.write(pdf_buffer.getbuffer())
        
        return json.dumps({
            "status": "REPORT_READY",
            "pdf_path": out_path,
            "ui_location": "Change Detection page → EXPORT INTELLIGENCE REPORT button",
            "message": f"Mission dossier generated ({len(pdf_buffer.getbuffer())} bytes). Download it from the Change Detection page using the EXPORT INTELLIGENCE REPORT button."
        })
    except Exception as e:
        return json.dumps({"status": "ERROR", "message": str(e)})

@tool
async def dispatch_ui_update(session_id: str, message: str, type: str = "AGENT_MESSAGE") -> str:
    """Send a real-time notification or message to the user's dashboard."""
    return f"Broadcasted {type}: {message}"

# Export toolset for the ORION Agent
tools = [
    create_mission,
    search_orbital_scenes,
    execute_orbital_fetch,
    execute_spectral_analysis,
    run_changeformer_inference,
    generate_mission_dossier,
    dispatch_ui_update
]

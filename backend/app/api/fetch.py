"""
Fetch API - orchestrates the multi-stage mission pipeline.
Handles TCI sync, Spectral Intel, Change Detection, and AI Synthesis.
"""
import asyncio
import json
import os
import logging
from datetime import datetime
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List

from app.core.database import get_pool
from app.pipelines.s2dr3 import execute_tci_phase, execute_ms_phase
from app.pipelines.planet import execute_planet_tci_phase, execute_planet_ms_phase
from app.pipelines.gee import execute_gee_tci_phase, execute_gee_ms_phase
from app.pipelines.changeformer import run_change_detection
from app.services.llm import generate_prefetch_context, generate_change_explanation, generate_insights_report, generate_index_briefings
from app.core.config import DATA_DIR

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

# Global state tracker for mission telemetry
_fetch_status = {}

class FetchRequest(BaseModel):
    aoi_geojson: dict
    t1_date: str
    t2_date: str
    source: str = "s2dr3"

def aoi_to_string(aoi_geojson: dict) -> str:
    """Converts AOI geojson/geometry to 'lon_min lat_min lon_max lat_max' string."""
    geom = aoi_geojson.get("geometry", aoi_geojson)
    coords = geom.get("coordinates", [])
    if not coords or not coords[0]:
        return "0 0 0 0"
    
    # Simple bounding box extraction from polygon/multipolygon
    lons = []
    lats = []
    
    def extract_coords(c_list):
        for item in c_list:
            if isinstance(item[0], (int, float)):
                lons.append(item[0])
                lats.append(item[1])
            else:
                extract_coords(item)
                
    extract_coords(coords)
    if not lons: return "0 0 0 0"
    return f"{min(lons)} {min(lats)} {max(lons)} {max(lats)}"

@router.post("/context")
async def get_prefetch_context(request: FetchRequest):
    """Provides AI-generated insight while mission images are loading."""
    try:
        context = await generate_prefetch_context(request.aoi_geojson, request.t1_date, request.t2_date)
        return {"id": "premission_ctx", "content": context}
    except Exception as e:
        return {"id": "premission_ctx", "content": "Initializing orbital links and analyzing geospatial context..."}

@router.post("/start")
async def start_fetch(request: FetchRequest):
    """
    Start the fetch pipeline - returns a project_id immediately.
    """
    logger.info(f">>> [FETCH] INITIATING MISSION START REQUEST - Source: {request.source}")
    pool = await get_pool()
    try:
        async with pool.acquire() as conn:
            project = await conn.fetchrow(
                "INSERT INTO projects (aoi_geojson) VALUES ($1) RETURNING id",
                json.dumps(request.aoi_geojson.get("geometry", request.aoi_geojson)),
            )
            project_id = project["id"]
        
        logger.info(f">>> [FETCH] MISSION {project_id} DB RECORD CREATED. Launching background task.")
        
        _fetch_status[project_id] = {
            "source": request.source,
            "stage": "tci_sync",
            "t1": "pending", "t2": "pending",
            "change_detection": "pending",
            "spectral_intel": "pending",
            "insights": "pending",
            "progress": {"t1": 0, "t2": 0},
            "t1_tci_url": None, "t2_tci_url": None,
            "logs": [],
            "results": {}
        }
        
        asyncio.create_task(
            _run_full_mission_sequence(project_id, request.aoi_geojson.get("geometry", request.aoi_geojson), request.t1_date, request.t2_date, request.source)
        )

        return {"project_id": project_id, "status": "mission_initiated"}
    except Exception as e:
        logger.error(f">>> [FETCH] CRITICAL STARTUP ERROR: {str(e)}")
        return JSONResponse(status_code=500, content={"error": str(e)})

async def _run_full_mission_sequence(project_id: int, aoi: dict, t1_date: str, t2_date: str, source: str):
    logger.info(f">>> [MISSION {project_id}] SEQUENCE COMMENCED.")
    try:
        # --- STAGE 1: TCI SYNCHRONIZATION ---
        async def fetch_tci(date, label):
            logger.info(f">>> [MISSION {project_id}] {label} SYNC START ({date})")
            try:
                def update_p(pct):
                    if project_id in _fetch_status:
                        _fetch_status[project_id]["progress"][label.lower()] = pct

                if source == "planet":
                    res = await execute_planet_tci_phase(date, aoi_to_string(aoi), label, project_id, update_p)
                elif source == "gee":
                    res = await execute_gee_tci_phase(date, aoi_to_string(aoi), label, project_id, update_p)
                else:
                    res = await execute_tci_phase(date, aoi_to_string(aoi), label, project_id, source="gamma", on_progress=update_p)
                
                if res and "error" not in res:
                    logger.info(f">>> [MISSION {project_id}] {label} TCI READY: {res['png_tci']}")
                    # Update status for UI
                    if project_id in _fetch_status:
                        rel = os.path.relpath(res['png_tci'], DATA_DIR)
                        status_key = label.lower()
                        _fetch_status[project_id][f"{status_key}_tci_url"] = f"/data/{rel.replace(os.sep, '/')}"
                        _fetch_status[project_id][status_key] = "ready"
                    return res
                else:
                    logger.error(f">>> [MISSION {project_id}] {label} TCI FAILED or License Restricted.")
                    return None
            except Exception as e:
                logger.error(f">>> [MISSION {project_id}] {label} TCI SYNC EXCEPTION: {str(e)}")
                return None

        t1_tci, t2_tci = await asyncio.gather(
            fetch_tci(t1_date, "T1"), 
            fetch_tci(t2_date, "T2")
        )
        
        if not t1_tci and not t2_tci:
            logger.error(f"[MISSION {project_id}] Both orbits failed. Stage 1 Critical Failure. Aborting.")
            return

        if not t1_tci or not t2_tci:
            logger.warning(f"[MISSION {project_id}] One orbit failed. Proceeding in DEGRADED MODE.")
            if project_id in _fetch_status:
                _fetch_status[project_id]["logs"].append("WARNING: Mission continuing in degraded mode. One orbital pass was unsuccessful.")

        _fetch_status[project_id]["stage"] = "intel_acquisition"

        # --- DB PRE-SAVE: Save images so Stage 2 can reference IDs ---
        pool = await get_pool()
        t1_dt = datetime.strptime(t1_date, '%Y-%m-%d').date()
        t2_dt = datetime.strptime(t2_date, '%Y-%m-%d').date()
        
        async with pool.acquire() as conn:
            if t1_tci:
                img1 = await conn.fetchrow("INSERT INTO images (project_id, type, source, date, tci_png_path) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                                          project_id, "t1", source, t1_dt, t1_tci["png_tci"])
                _fetch_status[project_id]["results"]["t1_db_id"] = img1["id"]
            
            if t2_tci:
                img2 = await conn.fetchrow("INSERT INTO images (project_id, type, source, date, tci_png_path) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                                          project_id, "t2", source, t2_dt, t2_tci["png_tci"])
                _fetch_status[project_id]["results"]["t2_db_id"] = img2["id"]
            
            _fetch_status[project_id]["t1_date"] = t1_date
            _fetch_status[project_id]["t2_date"] = t2_date

        _fetch_status[project_id]["stage"] = "intel_acquisition"
        logger.info(f">>> [MISSION {project_id}] STAGE 1 COMPLETE. STARTING INTELLIGENCE...")

        async def run_indices():
            try:
                logger.info(f">>> [MISSION {project_id}] EXTRACTING SPECTRAL INDICES...")
                if project_id in _fetch_status:
                    _fetch_status[project_id]["spectral_intel"] = "syncing"
                
                async def proc_ms(res, label):
                    if source == "planet":
                        return await execute_planet_ms_phase(res, project_id)
                    elif source == "gee":
                        return await execute_gee_ms_phase(res, project_id, on_progress=None)
                    else:
                        return await execute_ms_phase(res, project_id, source="s2dr3")

                t1_ms, t2_ms = await asyncio.gather(proc_ms(t1_tci, "T1"), proc_ms(t2_tci, "T2"))
                
                async with pool.acquire() as conn:
                    for r, db_id in [(t1_ms, img1["id"]), (t2_ms, img2["id"])]:
                        if not r: continue
                        for name, idx in r.get("indices", {}).items():
                            await conn.execute("INSERT INTO indices (image_id, index_type, image_path, mean_value) VALUES ($1,$2,$3,$4)",
                                               db_id, name, idx.get("path", ""), idx["stats"].get("mean", 0))

                t1_indices = {}
                if t1_ms:
                    for name, idx in t1_ms.get("indices", {}).items():
                        rel = os.path.relpath(idx["path"], DATA_DIR)
                        t1_indices[name] = {**idx, "url": f"/data/{rel.replace(os.sep, '/')}"}
                
                t2_indices = {}
                if t2_ms:
                    for name, idx in t2_ms.get("indices", {}).items():
                        rel = os.path.relpath(idx["path"], DATA_DIR)
                        t2_indices[name] = {**idx, "url": f"/data/{rel.replace(os.sep, '/')}"}

                for name in t2_indices:
                    if name in t1_indices:
                        t1_val = t1_indices[name]["stats"]["mean"]
                        t2_val = t2_indices[name]["stats"]["mean"]
                        briefing = await generate_index_briefings(name, t1_val, t2_val, t2_indices[name]["meta"])
                        t2_indices[name]["briefing"] = briefing

                if project_id in _fetch_status:
                    _fetch_status[project_id]["results"]["indices"] = {"t1": t1_indices, "t2": t2_indices}
                    _fetch_status[project_id]["spectral_intel"] = "ready"
                
                logger.info(f">>> [MISSION {project_id}] SPECTRAL INTEL READY.")
                return {"t1": t1_ms, "t2": t2_ms}
            except Exception as e:
                logger.error(f">>> [MISSION {project_id}] INDICES ERROR: {e}")
                if project_id in _fetch_status:
                    _fetch_status[project_id]["spectral_intel"] = "error"
                return {"t1": None, "t2": None}

        ms_results = await run_indices()

        # MISSION STAGE 1 & 2 COMPLETE
        _fetch_status[project_id]["stage"] = "complete"
        logger.info(f">>> [MISSION {project_id}] BASELINE TELEMETRY READY.")

    except Exception as e:
        logger.critical(f"[MISSION {project_id}] CRITICAL PIPELINE FAILURE: {e}")
        if project_id in _fetch_status:
            _fetch_status[project_id]["stage"] = "failed"

async def return_none(): return None

@router.post("/detect-changes/{project_id}")
async def trigger_change_detection(project_id: int):
    """
    Manually trigger Change Detection for a project.
    """
    if project_id not in _fetch_status:
        # Try to reconstruct from DB if possible, but for now we assume it's in-memory
        return JSONResponse(status_code=404, content={"error": "Project session not found"})

    status = _fetch_status[project_id]
    status["change_detection"] = "syncing"
    status["logs"] = ["Initializing Orbital Inference Engine...", "Connecting to ChangeFormer V6 weights..."]
    
    # We need the TCI paths
    pool = await get_pool()
    async with pool.acquire() as conn:
        t1 = await conn.fetchrow("SELECT * FROM images WHERE project_id=$1 AND type='t1'", project_id)
        t2 = await conn.fetchrow("SELECT * FROM images WHERE project_id=$1 AND type='t2'", project_id)
        
        if not t1 or not t2:
            return JSONResponse(status_code=400, content={"error": "Images not synced yet"})

        t1_path = t1["tci_png_path"]
        t2_path = t2["tci_png_path"]
    def add_log(msg):
        if project_id in _fetch_status:
            _fetch_status[project_id]["logs"].append(msg)
            # Keep only last 50 logs for UI performance
            if len(_fetch_status[project_id]["logs"]) > 50:
                _fetch_status[project_id]["logs"].pop(0)

    # Reset mission state to keep UI polling alive
    _fetch_status[project_id]["stage"] = "intel_acquisition"
    _fetch_status[project_id]["change_detection"] = "syncing"
    _fetch_status[project_id]["insights"] = "pending"
    _fetch_status[project_id]["logs"] = ["Initializing neural ChangeFormer link..."]

    # Launch task
    asyncio.create_task(_run_manual_cd_workflow(project_id, t1, t2, t1["tci_png_path"], t2["tci_png_path"], add_log))
    
    return {"status": "detection_started"}

async def _run_manual_cd_workflow(project_id, t1_db, t2_db, t1_path, t2_path, log_fn):
    try:
        output_dir = os.path.join(DATA_DIR, str(project_id), "change")
        cd_res = await run_change_detection(t1_path, t2_path, output_dir, on_log=log_fn)
        
        pool = await get_pool()
        async with pool.acquire() as conn:
            cd_db = await conn.fetchrow("INSERT INTO change_detection (project_id, t1_image_id, t2_image_id, mask_path, confidence) VALUES ($1,$2,$3,$4,$5) RETURNING id",
                                       project_id, t1_db["id"], t2_db["id"], cd_res["mask_path"], float(cd_res["stats"].get("change_percentage", 0)) / 100.0)
        
        # Synthesis
        log_fn("Generating AI Narratives and Insights...")
        t1_date = t1_db["date"].strftime('%Y-%m-%d')
        t2_date = t2_db["date"].strftime('%Y-%m-%d')
        
        # Get indices for synthesis
        async with pool.acquire() as conn:
            t1_indices_rows = await conn.fetch("SELECT * FROM indices WHERE image_id=$1", t1_db["id"])
            t2_indices_rows = await conn.fetch("SELECT * FROM indices WHERE image_id=$1", t2_db["id"])
            t1_indices = {r["index_type"]: {"mean": r["mean_value"]} for r in t1_indices_rows}
            t2_indices = {r["index_type"]: {"mean": r["mean_value"]} for r in t2_indices_rows}

        confidence_val = float(cd_res["stats"].get("change_percentage", 0)) / 100.0
        explanation = await generate_change_explanation(confidence_val, t1_date, t2_date, t1_indices, t2_indices)
        
        # Ensure cd_res has confidence for report generation
        cd_res["confidence"] = confidence_val
        report = await generate_insights_report({}, t1_date, t2_date, t1_indices, t2_indices, cd_res, [])

        # Update status
        rel_mask = os.path.relpath(cd_res["mask_path"], DATA_DIR) if cd_res["mask_path"] else None
        
        _fetch_status[project_id]["results"]["cd"] = {
            "mask_url": f"/data/{rel_mask.replace(os.sep, '/')}" if rel_mask else None,
            "confidence": confidence_val,
            "t1_date": t1_date, 
            "t2_date": t2_date
        }
        _fetch_status[project_id]["results"]["explanation"] = explanation
        _fetch_status[project_id]["results"]["report"] = report
        
        # FINAL SIGNAL
        _fetch_status[project_id]["change_detection"] = "ready"
        _fetch_status[project_id]["insights"] = "ready"
        log_fn("[SUCCESS] Intelligence Workflow Complete.")
        
    except Exception as e:
        log_fn(f"[ERROR] Mission Failure: {e}")
        if project_id in _fetch_status:
            _fetch_status[project_id]["change_detection"] = "error"
            _fetch_status[project_id]["stage"] = "failed"

@router.get("/status/{project_id}")
async def fetch_status(project_id: int):
    return _fetch_status.get(project_id, {"status": "not_found"})

@router.get("/projects")
async def list_projects():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT p.id, p.created_at, COUNT(i.id) as image_count FROM projects p LEFT JOIN images i ON i.project_id=p.id GROUP BY p.id ORDER BY p.created_at DESC LIMIT 20")
    return [dict(r) for r in rows]

@router.get("/project/{project_id}")
async def get_project(project_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("SELECT * FROM projects WHERE id=$1", project_id)
        if not project: return JSONResponse(status_code=404, content={"error": "Not found"})
        images = await conn.fetch("SELECT * FROM images WHERE project_id=$1", project_id)
        result = dict(project)
        result["images"] = []
        for img in images:
            img_dict = dict(img)
            indices = await conn.fetch("SELECT * FROM indices WHERE image_id=$1", img["id"])
            img_dict["indices"] = [dict(i) for i in indices]
            if img_dict.get("tci_png_path"):
                rel = os.path.relpath(img_dict["tci_png_path"], DATA_DIR)
                img_dict["tci_url"] = f"/data/{rel.replace(os.sep, '/')}"
            result["images"].append(img_dict)
    return result

@router.get("/valid-dates")
async def get_valid_dates(
    bbox: str = Query(..., description="minx,miny,maxx,maxy"),
    year: int = Query(..., description="Year to query, e.g. 2023")
):
    """Fetch all dates with Sentinel-2 SR imagery for the given AOI and year via GEE."""
    try:
        import ee
        coords = [float(c.strip()) for c in bbox.split(",")]
        if len(coords) != 4:
            return JSONResponse(status_code=400, content={"error": "bbox must be minx,miny,maxx,maxy"})
        
        minx, miny, maxx, maxy = coords
        aoi = ee.Geometry.Rectangle([minx, miny, maxx, maxy])

        start = f"{year}-01-01"
        end = f"{year}-12-31"

        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR")
            .filterBounds(aoi)
            .filterDate(start, end)
        )

        dates = (
            collection.aggregate_array('system:time_start')
            .map(lambda d: ee.Date(d).format('YYYY-MM-dd'))
            .distinct()
            .sort()
        )

        date_list = dates.getInfo()
        logger.info(f">>> [GEE] Found {len(date_list)} valid dates for year {year}")
        return {"dates": date_list, "year": year, "count": len(date_list)}
    except Exception as e:
        logger.error(f">>> [GEE] Valid dates query failed: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

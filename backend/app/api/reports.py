import os
import json
import logging
import traceback
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Project, Image, ChangeDetection, Index
from app.services.pdf_report import MissionReportGenerator
from app.services.ai_narrative import AINarrativeService
from app.core.config import DATA_DIR
from app.core.logger import get_logger

logger = get_logger("app.reports")
router = APIRouter()
ai_analyst = AINarrativeService()

@router.get("/ping")
async def ping_reports():
    return {"status": "reports_router_active"}

@router.get("/mission/{project_id}")
async def download_mission_report(project_id: int, db: AsyncSession = Depends(get_db)):
    logger.info(f">>> [REPORTS] ORM DOSSIER AGGREGATION FOR MISSION: {project_id}")
    
    try:
        # 1. Fetch Mission Context with Eager Index/Image Loading
        query = select(Project).where(Project.id == project_id).options(
            selectinload(Project.images).selectinload(Image.indices),
            selectinload(Project.change_detections)
        )
        result = await db.execute(query)
        project = result.scalar_one_or_none()

        if not project:
            logger.error(f">>> [REPORTS] MISSION {project_id} DATA NOT FOUND")
            raise HTTPException(status_code=404, detail="Project not found")

        # 2. Extract Latest Change Detection (optional — may not have run yet)
        cd = project.change_detections[-1] if project.change_detections else None
        if not cd:
            logger.warning(f">>> [REPORTS] No change_detection for PID {project_id}. Generating partial report.")

        # 3. Resolve T1/T2 Images from Relationships
        if cd:
            t1 = next((i for i in project.images if i.id == cd.t1_image_id), None)
            t2 = next((i for i in project.images if i.id == cd.t2_image_id), None)
        else:
            t1 = next((i for i in project.images if i.type == 't1'), None)
            t2 = next((i for i in project.images if i.type == 't2'), None)
        
        if not t1 and not t2:
            logger.error(f">>> [REPORTS] ORM SYNC ERROR: No images at all for PID {project_id}")
            raise HTTPException(status_code=404, detail="Mission images missing from database.")

        # 4. Pack Spectral Indicators from whichever images exist
        indices = []
        target_img = t2 or t1
        if target_img:
            for row in target_img.indices:
                indices.append({
                    "name": row.index_type,
                    "mean_val": row.mean_value,
                    "heatmap_path": row.image_path,
                    "description": _get_index_desc(row.index_type)
                })
        
        logger.info(f">>> [REPORTS] FOUND {len(indices)} MODEL-BACKED SPECTRAL INDICATORS")

        # 5. Generate AI Narrative Brief
        change_pct = (cd.confidence * 100) if cd and cd.confidence else 0
        report_data_temp = {
            "project_id": project_id,
            "t1_date": str(t1.date) if t1 else "N/A",
            "t2_date": str(t2.date) if t2 else "N/A",
            "change_pct": change_pct,
            "indices": indices
        }
        try:
            ai_brief = await ai_analyst.generate_analysis(report_data_temp)
        except Exception as ai_err:
            logger.warning(f">>> [REPORTS] AI narrative failed: {ai_err}. Using fallback.")
            ai_brief = "AI analysis unavailable for this mission."

        # 6. Calculate Impact Metrics (Approximate)
        total_area_m2 = _calculate_geojson_area(project.aoi_geojson)
        disturbed_area_m2 = total_area_m2 * (cd.confidence or 0) if cd else 0
        
        # 7. Build Report Data Payload with full compatibility for pdf_report.py
        report_data = {
            "project_id": project_id,
            "aoi_geojson": project.aoi_geojson,
            "t1_date": str(t1.date) if t1 else "N/A",
            "t2_date": str(t2.date) if t2 else "N/A",
            "source": (t2 or t1).source if (t2 or t1) else "unknown",
            "change_pct": change_pct,
            "area_m2": disturbed_area_m2,
            "area_km2": disturbed_area_m2 / 1_000_000,
            "area_ha": disturbed_area_m2 / 10_000,
            "mask_path": cd.mask_path if cd else None,
            "t1_path": t1.tci_png_path if t1 else None,
            "t2_path": t2.tci_png_path if t2 else None,
            "indices": indices,
            "ai_summary": ai_brief
        }

        # 8. Generate PDF via Service
        logger.info(f">>> [REPORTS] ORM PIPELINE COMPLETE. BUILDING PDF DOSSIER...")
        generator = MissionReportGenerator(report_data)
        pdf_buffer = generator.generate()
        
        return StreamingResponse(
            pdf_buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=UrbanEye_Mission_{project_id}.pdf"}
        )

    except Exception as e:
        err_msg = traceback.format_exc()
        logger.error(f">>> [REPORTS] FATAL MISSION AGGREGATION FAILURE:\n{err_msg}")
        raise HTTPException(status_code=500, detail=f"Report build failed: {str(e)}")

def _get_index_desc(name: str) -> str:
    descs = {
        "NDVI": "Normalized Difference Vegetation Index - Measures photosynthetic activity.",
        "NDWI": "Normalized Difference Water Index - Identifies surface water presence.",
        "NDBI": "Normalized Difference Built-Up Index - Maps urban density and asphalt.",
        "NDRE": "Normalized Difference Red Edge - Sensitive to nitrogen content and early stress.",
        "EVI": "Enhanced Vegetation Index - Corrects for atmospheric and canopy soil noise.",
        "BSI": "Bare Soil Index - Highlights exposed ground and construction sites."
    }
    return descs.get(name, "Multispectral Indicator")

def _calculate_geojson_area(geojson: dict) -> float:
    """Returns approximate area in square meters from GeoJSON geometry."""
    try:
        coords = []
        geom = geojson.get("geometry", geojson)
        c = geom.get("coordinates", [])
        
        def extract(lst):
            for item in lst:
                if isinstance(item[0], (int, float)):
                    coords.append(item)
                else: extract(item)
        
        extract(c)
        if not coords: return 10000.0
        
        # Simple bounding box approximation
        lons = [p[0] for p in coords]
        lats = [p[1] for p in coords]
        
        width = (max(lons) - min(lons)) * 111320 * 0.7 # Approx degree to meter
        height = (max(lats) - min(lats)) * 110540
        return abs(width * height)
    except:
        return 10000.0 # 1 hectare fallback

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.models.models import Project, Image, ChangeDetection, Compliance, Index
from app.services.llm import generate_insights_report
from pydantic import BaseModel
from app.core.logger import get_logger

logger = get_logger("app.insights")
router = APIRouter()

class InsightRequest(BaseModel):
    project_id: int
    report_type: str = "standard"
    detail_level: str = "standard"

@router.post("/generate")
async def generate_insights(request: InsightRequest, db: AsyncSession = Depends(get_db)):
    logger.info(f">>> [INSIGHTS] ORM MISSION SYNC FOR PROJECT: {request.project_id}")
    
    try:
        # 1. Fetch Project with all relationships eager-loaded
        query = select(Project).where(Project.id == request.project_id).options(
            selectinload(Project.images).selectinload(Image.indices),
            selectinload(Project.change_detections),
            selectinload(Project.compliance)
        )
        result = await db.execute(query)
        project = result.scalar_one_or_none()

        if not project:
            logger.error(f">>> [INSIGHTS] PROJECT {request.project_id} NOT FOUND")
            raise HTTPException(status_code=404, detail="Project not found")

        # 2. Extract and format data from models
        t1 = next((i for i in project.images if i.type == "t1"), None)
        t2 = next((i for i in project.images if i.type == "t2"), None)
        
        t1_indices = {idx.index_type: {"mean": idx.mean_value} for i in project.images if i.type == "t1" for idx in i.indices}
        t2_indices = {idx.index_type: {"mean": idx.mean_value} for i in project.images if i.type == "t2" for idx in i.indices}

        # Get latest change detection
        latest_cd = project.change_detections[-1] if project.change_detections else None
        change_data = {
            "mask_path": latest_cd.mask_path,
            "confidence": latest_cd.confidence
        } if latest_cd else {}

        compliance_list = [{"rule_name": r.rule_name, "description": r.description} for r in project.compliance]

        logger.info(f">>> [INSIGHTS] ORM DATA SYNCED. Synthesizing briefing...")

        # 3. Generate Report via LLM Service
        report = generate_insights_report(
            aoi_geojson=project.aoi_geojson,
            t1_date=str(t1.date) if t1 else "N/A",
            t2_date=str(t2.date) if t2 else "N/A",
            indices_t1=t1_indices,
            indices_t2=t2_indices,
            change_data=change_data,
            compliance_rules=compliance_list,
            report_type=request.report_type,
            detail_level=request.detail_level,
        )

        return report
    except Exception as e:
        logger.error(f">>> [INSIGHTS] FATAL ORM RECOVERY FAILED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Insights generation failed: {str(e)}")

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.core.database import get_pool
from app.services.llm import generate_insights_report

router = APIRouter()


class InsightRequest(BaseModel):
    project_id: int
    report_type: str = "standard"
    detail_level: str = "standard"


@router.post("/generate")
async def generate_insights(request: InsightRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        project = await conn.fetchrow("SELECT * FROM projects WHERE id=$1", request.project_id)
        if not project:
            return JSONResponse(status_code=404, content={"error": "Project not found"})

        images = await conn.fetch("SELECT * FROM images WHERE project_id=$1 ORDER BY type", request.project_id)
        change = await conn.fetchrow(
            "SELECT * FROM change_detection WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1",
            request.project_id
        )
        compliance = await conn.fetch("SELECT * FROM compliance WHERE project_id=$1", request.project_id)

    t1 = next((i for i in images if i["type"] == "t1"), None)
    t2 = next((i for i in images if i["type"] == "t2"), None)

    # Get indices
    t1_indices = {}
    t2_indices = {}
    if t1:
        pool2 = await get_pool()
        async with pool2.acquire() as conn:
            for row in await conn.fetch("SELECT index_type, mean_value FROM indices WHERE image_id=$1", t1["id"]):
                t1_indices[row["index_type"]] = {"mean": row["mean_value"]}
    if t2:
        pool2 = await get_pool()
        async with pool2.acquire() as conn:
            for row in await conn.fetch("SELECT index_type, mean_value FROM indices WHERE image_id=$1", t2["id"]):
                t2_indices[row["index_type"]] = {"mean": row["mean_value"]}

    change_data = dict(change) if change else {}
    compliance_list = [{"rule_name": r["rule_name"], "description": r["description"]} for r in compliance]

    report = generate_insights_report(
        aoi_geojson=project["aoi_geojson"],
        t1_date=str(t1["date"]) if t1 else "N/A",
        t2_date=str(t2["date"]) if t2 else "N/A",
        indices_t1=t1_indices,
        indices_t2=t2_indices,
        change_data=change_data,
        compliance_rules=compliance_list,
        report_type=request.report_type,
        detail_level=request.detail_level,
    )

    return report

import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.database import get_pool
from app.pipelines.changeformer import run_change_detection
from app.services.llm import generate_change_explanation
from app.core.config import DATA_DIR

router = APIRouter()


class ChangeDetectionRequest(BaseModel):
    project_id: int


@router.post("/run")
async def run_detection(request: ChangeDetectionRequest):
    """Run ChangeFormer on the project's t1 and t2 images."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        images = await conn.fetch(
            "SELECT * FROM images WHERE project_id=$1 ORDER BY type", request.project_id
        )

    if len(images) < 2:
        return JSONResponse(status_code=400, content={"error": "Both t1 and t2 images required"})

    t1 = next((i for i in images if i["type"] == "t1"), None)
    t2 = next((i for i in images if i["type"] == "t2"), None)

    if not t1 or not t2:
        return JSONResponse(status_code=400, content={"error": "Missing t1 or t2 image"})

    t1_path = t1["tci_png_path"]
    t2_path = t2["tci_png_path"]

    if not t1_path or not os.path.exists(t1_path):
        return JSONResponse(status_code=400, content={"error": "T1 image file not found"})
    if not t2_path or not os.path.exists(t2_path):
        return JSONResponse(status_code=400, content={"error": "T2 image file not found"})

    output_dir = os.path.join(DATA_DIR, str(request.project_id), "change")
    result = await run_change_detection(t1_path, t2_path, output_dir)

    # Get indices for LLM explanation
    async with pool.acquire() as conn:
        t1_indices_rows = await conn.fetch("SELECT index_type, mean_value FROM indices WHERE image_id=$1", t1["id"])
        t2_indices_rows = await conn.fetch("SELECT index_type, mean_value FROM indices WHERE image_id=$1", t2["id"])

    t1_indices = {r["index_type"]: {"mean": r["mean_value"]} for r in t1_indices_rows}
    t2_indices = {r["index_type"]: {"mean": r["mean_value"]} for r in t2_indices_rows}

    explanation = generate_change_explanation(
        result["confidence"],
        str(t1["date"]),
        str(t2["date"]),
        t1_indices,
        t2_indices,
    )

    # Save to DB
    async with pool.acquire() as conn:
        cd = await conn.fetchrow(
            "INSERT INTO change_detection (project_id, t1_image_id, t2_image_id, mask_path, confidence) VALUES ($1,$2,$3,$4,$5) RETURNING id",
            request.project_id, t1["id"], t2["id"], result["mask_path"], result["confidence"],
        )

    mask_rel = os.path.relpath(result["mask_path"], DATA_DIR)
    mask_url = f"/data/{mask_rel.replace(os.sep, '/')}"

    t1_rel = os.path.relpath(t1_path, DATA_DIR)
    t2_rel = os.path.relpath(t2_path, DATA_DIR)

    return {
        "id": cd["id"],
        "mask_url": mask_url,
        "confidence": result["confidence"],
        "t1_url": f"/data/{t1_rel.replace(os.sep, '/')}",
        "t2_url": f"/data/{t2_rel.replace(os.sep, '/')}",
        "t1_date": str(t1["date"]),
        "t2_date": str(t2["date"]),
        "explanation": explanation,
    }


@router.get("/result/{project_id}")
async def get_result(project_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        cd = await conn.fetchrow(
            "SELECT * FROM change_detection WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1",
            project_id,
        )
        if not cd:
            return JSONResponse(status_code=404, content={"error": "No result found"})

        t1 = await conn.fetchrow("SELECT * FROM images WHERE id=$1", cd["t1_image_id"])
        t2 = await conn.fetchrow("SELECT * FROM images WHERE id=$1", cd["t2_image_id"])

    mask_url = ""
    if cd["mask_path"]:
        rel = os.path.relpath(cd["mask_path"], DATA_DIR)
        mask_url = f"/data/{rel.replace(os.sep, '/')}"

    return {
        "id": cd["id"],
        "mask_url": mask_url,
        "confidence": cd["confidence"],
        "t1_url": f"/data/{os.path.relpath(t1['tci_png_path'], DATA_DIR).replace(os.sep, '/')}" if t1 and t1["tci_png_path"] else "",
        "t2_url": f"/data/{os.path.relpath(t2['tci_png_path'], DATA_DIR).replace(os.sep, '/')}" if t2 and t2["tci_png_path"] else "",
        "t1_date": str(t1["date"]) if t1 else "",
        "t2_date": str(t2["date"]) if t2 else "",
    }

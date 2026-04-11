import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.core.database import get_pool
from app.core.config import DATA_DIR

router = APIRouter()


@router.get("/{project_id}")
async def get_indices(project_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        images = await conn.fetch(
            "SELECT * FROM images WHERE project_id=$1 ORDER BY type", project_id
        )
        if not images:
            return JSONResponse(status_code=404, content={"error": "No images found"})

        result = {}
        for img in images:
            indices = await conn.fetch(
                "SELECT index_type, image_path, mean_value FROM indices WHERE image_id=$1", img["id"]
            )
            img_data = {
                "tci_url": "",
                "date": str(img["date"]),
                "source": img["source"],
                "indices": {},
            }
            if img["tci_png_path"] and os.path.exists(img["tci_png_path"]):
                rel = os.path.relpath(img["tci_png_path"], DATA_DIR)
                img_data["tci_url"] = f"/data/{rel.replace(os.sep, '/')}"

            for idx in indices:
                url = ""
                if idx["image_path"] and os.path.exists(idx["image_path"]):
                    rel = os.path.relpath(idx["image_path"], DATA_DIR)
                    url = f"/data/{rel.replace(os.sep, '/')}"
                img_data["indices"][idx["index_type"]] = {
                    "url": url,
                    "mean": idx["mean_value"],
                }
            result[img["type"]] = img_data

    return result

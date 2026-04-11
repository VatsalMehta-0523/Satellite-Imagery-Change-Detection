from fastapi import APIRouter
from app.core.database import get_pool

router = APIRouter()

@router.get("/")
async def list_projects():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT p.id, p.aoi_geojson, p.created_at FROM projects p ORDER BY p.created_at DESC LIMIT 20"
        )
    return [dict(r) for r in rows]

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_pool

router = APIRouter()


class RuleCreate(BaseModel):
    project_id: int
    rule_name: str
    description: str


class RuleUpdate(BaseModel):
    rule_name: str
    description: str


@router.get("/all")
async def list_all_rules():
    """Retrieve all compliance rules in the system."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT * FROM compliance ORDER BY id DESC")
    return [dict(r) for r in rows]


@router.get("/{project_id}")
async def list_rules(project_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM compliance WHERE project_id=$1 ORDER BY id", project_id
        )
    return [dict(r) for r in rows]


@router.post("/")
async def add_rule(rule: RuleCreate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO compliance (project_id, rule_name, description) VALUES ($1,$2,$3) RETURNING *",
            rule.project_id, rule.rule_name, rule.description,
        )
    return dict(row)


@router.put("/{rule_id}")
async def update_rule(rule_id: int, rule: RuleUpdate):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "UPDATE compliance SET rule_name=$1, description=$2 WHERE id=$3 RETURNING *",
            rule.rule_name, rule.description, rule_id,
        )
    if not row:
        return JSONResponse(status_code=404, content={"error": "Rule not found"})
    return dict(row)


@router.delete("/{rule_id}")
async def delete_rule(rule_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("DELETE FROM compliance WHERE id=$1", rule_id)
    return {"deleted": True}

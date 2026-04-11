import os
import asyncpg
from typing import Optional
from contextlib import asynccontextmanager

from app.core.config import DATABASE_URL

_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        except Exception as e:
            print(f"Failed to create database pool: {e}")
            raise
    return _pool

async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None

async def create_tables():
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS projects (
                    id SERIAL PRIMARY KEY,
                    aoi_geojson JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS images (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                    type VARCHAR(4) NOT NULL CHECK (type IN ('t1','t2')),
                    source VARCHAR(50) NOT NULL DEFAULT 's2dr3',
                    date DATE NOT NULL,
                    tci_png_path TEXT,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_images_project ON images(project_id);

                CREATE TABLE IF NOT EXISTS indices (
                    id SERIAL PRIMARY KEY,
                    image_id INTEGER REFERENCES images(id) ON DELETE CASCADE,
                    index_type VARCHAR(10) NOT NULL,
                    image_path TEXT,
                    mean_value DOUBLE PRECISION
                );

                CREATE INDEX IF NOT EXISTS idx_indices_image ON indices(image_id);

                CREATE TABLE IF NOT EXISTS change_detection (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                    t1_image_id INTEGER REFERENCES images(id),
                    t2_image_id INTEGER REFERENCES images(id),
                    mask_path TEXT,
                    confidence DOUBLE PRECISION,
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS compliance (
                    id SERIAL PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                    rule_name VARCHAR(255) NOT NULL,
                    description TEXT,
                    status VARCHAR(20) DEFAULT 'pending',
                    created_at TIMESTAMPTZ DEFAULT NOW()
                );
            """)

async def get_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn

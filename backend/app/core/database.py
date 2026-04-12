import os
import asyncpg
from typing import Optional
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import DATABASE_URL
from app.core.logger import get_logger

logger = get_logger("app.core.database")

# 1. RAW ASYNCPG POOL (For high-speed agent tools)
_pool: Optional[asyncpg.Pool] = None

async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        except Exception as e:
            logger.error(f">>> [DB] CRITICAL: Failed to create database pool: {e}")
            raise
    return _pool

async def close_pool():
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None

# 2. SQLALCHEMY ASYNC INFRASTRUCTURE (For ORM models)
# Ensure protocol is correct for asyncpg
SQLALCHEMY_ASYNC_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(
    SQLALCHEMY_ASYNC_URL,
    pool_pre_ping=True,
    echo=False # Set to True for debugging SQL
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db():
    """FastAPI Dependency for AsyncSession"""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            raise e
        finally:
            await session.close()

# Keep compatibility with existing get_pool code
async def get_raw_conn():
    pool = await get_pool()
    async with pool.acquire() as conn:
        yield conn

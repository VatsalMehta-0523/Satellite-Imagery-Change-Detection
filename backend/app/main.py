import asyncio
import sys
import os
from contextlib import asynccontextmanager
import time

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import logging
from app.api import fetch, change_detection, indices, compliance, insights, projects, reports, agent_ws
from app.core.database import close_pool

from app.core.logger import setup_logging, get_logger
setup_logging()
logger = get_logger("app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Application starting up...")
    
    yield
    await close_pool()

app = FastAPI(title="Satellite Change Detection SaaS", version="1.0.0", lifespan=lifespan)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    logger.info(f">>> [API] {request.method} {request.url.path} - Status: {response.status_code} - Done in {duration:.3f}s")
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for serving processed images
os.makedirs("data", exist_ok=True)
app.mount("/data", StaticFiles(directory="data"), name="data")

app.include_router(fetch.router, prefix="/api/fetch", tags=["fetch"])
app.include_router(change_detection.router, prefix="/api/change-detection", tags=["change-detection"])
app.include_router(indices.router, prefix="/api/indices", tags=["indices"])
app.include_router(compliance.router, prefix="/api/compliance", tags=["compliance"])
app.include_router(insights.router, prefix="/api/insights", tags=["insights"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(agent_ws.router, tags=["agent"])

@app.get("/health")
def health():
    return {"status": "ok"}

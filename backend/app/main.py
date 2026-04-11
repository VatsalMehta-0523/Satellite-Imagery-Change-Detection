import asyncio
import sys
import os
from contextlib import asynccontextmanager

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import logging
from app.api import fetch, change_detection, indices, compliance, insights, projects
from app.core.database import create_tables, close_pool

# Initialize Global Logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    try:
        await create_tables()
        print("Database tables initialized.")
    except Exception as e:
        print(f"Error during database initialization: {e}")
    
    yield
    
    # Shutdown: close pool
    await close_pool()

app = FastAPI(title="Satellite Change Detection SaaS", version="1.0.0", lifespan=lifespan)

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

@app.get("/health")
def health():
    return {"status": "ok"}

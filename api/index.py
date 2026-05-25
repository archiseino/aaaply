import logging
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.cache import KV_AVAILABLE, kv, _memory_cache
from api.routes.ai import router as ai_router
from api.routes.jobs import router as jobs_router
from api.routes.sheets import router as sheets_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sobatapply")

app = FastAPI(title="SobatApply API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)
app.include_router(jobs_router)
app.include_router(sheets_router)


@app.get("/")
async def root():
    return {"status": "ok", "message": "SobatApply API v2.0 is running", "kv_connected": KV_AVAILABLE}


@app.get("/api/health")
async def health():
    kv_status = "unavailable"
    if KV_AVAILABLE:
        try:
            kv.ping()
            kv_status = "connected"
        except Exception:
            kv_status = "error"
    return {"status": "ok", "kv": kv_status, "memory_cache_items": len(_memory_cache)}

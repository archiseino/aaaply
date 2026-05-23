import os
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Header, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from .models import (
    GenerateEmailRequest,
    ReviseEmailRequest,
    ExtractTextRequest,
    ShowCVRequest,
)
from .services import ai_service, supabase_service, scraper_service

import os
import shutil
import uuid
import tempfile
import platform
import subprocess
import hashlib
import json
import asyncio
import time
import random
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sobatapply")

try:
    from upstash_redis import Redis as UpstashRedis
    _KV_URL = os.environ.get("KV_REST_API_URL")
    _KV_TOKEN = os.environ.get("KV_REST_API_TOKEN")
    if _KV_URL and _KV_TOKEN:
        kv = UpstashRedis(url=_KV_URL, token=_KV_TOKEN)
        KV_AVAILABLE = True
        logger.info("Vercel KV (Upstash Redis) connected")
    else:
        kv = None
        KV_AVAILABLE = False
except ImportError:
    kv = None
    KV_AVAILABLE = False

_memory_cache: dict[str, tuple[str, float]] = {}
MEMORY_CACHE_MAX = 200

def _memory_get(key: str) -> Optional[str]:
    if key not in _memory_cache:
        return None
    value, expire_at = _memory_cache[key]
    if time.time() > expire_at:
        del _memory_cache[key]
        return None
    return value

def _memory_set(key: str, value: str, ttl_seconds: int = 86400) -> None:
    if len(_memory_cache) >= MEMORY_CACHE_MAX:
        oldest = sorted(_memory_cache.items(), key=lambda x: x[1][1])[:50]
        for k, _ in oldest:
            del _memory_cache[k]
    _memory_cache[key] = (value, time.time() + ttl_seconds)

CACHE_TTL_GENERATE = 60 * 60 * 24
CACHE_TTL_CV_SUMMARY = 60 * 60 * 24 * 7
CACHE_TTL_RATE_LIMIT = 60 * 60

async def cache_get(key: str) -> Optional[str]:
    if KV_AVAILABLE:
        try:
            return kv.get(key)
        except Exception as e:
            logger.error(f"KV get error: {e}")
    return _memory_get(key)

async def cache_set(key: str, value: str, ttl: int = CACHE_TTL_GENERATE) -> None:
    if KV_AVAILABLE:
        try:
            kv.set(key, value, ex=ttl)
            return
        except Exception as e:
            logger.error(f"KV set error: {e}")
    _memory_set(key, value, ttl)

async def cache_incr(key: str, ttl: int = CACHE_TTL_RATE_LIMIT) -> int:
    if KV_AVAILABLE:
        try:
            val = kv.incr(key)
            if val == 1:
                kv.expire(key, ttl)
            return val
        except Exception as e:
            logger.error(f"KV incr error: {e}")
    raw = _memory_get(key)
    count = (int(raw) + 1) if raw else 1
    _memory_set(key, str(count), ttl)
    return count

MAX_CONTEXT_CHARS = 15000
MAX_CV_RAW_CHARS = 15000
MAX_CV_SUMMARY_CHARS = 2000
MAX_REVISE_BODY_CHARS = 10000
MAX_GENERATE_PER_HOUR = 50
MAX_EXTRACT_PER_HOUR = 100

def make_generate_key(company: str, job_title: str, context: str, cv_snippet: str) -> str:
    raw = f"gen|{company.lower()}|{job_title.lower()}|{context[:100]}|{cv_snippet[:100]}"
    return "sa:" + hashlib.md5(raw.encode()).hexdigest()

def make_cv_summary_key(cv_text: str) -> str:
    return "sa:cvsum:" + hashlib.md5(cv_text.encode()).hexdigest()

def make_rate_limit_key(ip: str, action: str) -> str:
    return f"sa:rl:{action}:{ip}"

async def check_rate_limit(request: Request, action: str = "generate", limit: int = MAX_GENERATE_PER_HOUR) -> None:
    ip = request.headers.get("x-forwarded-for", "unknown").split(",")[0].strip()
    key = make_rate_limit_key(ip, action)
    count = await cache_incr(key, ttl=CACHE_TTL_RATE_LIMIT)
    if count > limit:
        logger.warning(f"Rate limit hit: ip={ip} action={action} count={count}")
        raise HTTPException(status_code=429, detail=f"Terlalu banyak permintaan. Batas: {limit} per jam.", headers={"Retry-After": "3600"})

def trim_input(text: Optional[str], max_chars: int, label: str = "input") -> str:
    """Silently trim text to max_chars. NEVER appends truncation markers
    that the AI might echo into its output."""
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    trimmed = text[:max_chars]
    last_space = trimmed.rfind(" ")
    if last_space > max_chars * 0.8:
        trimmed = trimmed[:last_space]
    logger.info(f"Trimmed {label}: {len(text)} -> {len(trimmed)} chars")
    return trimmed

app = FastAPI(title="SobatApply API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

@app.post("/api/extract")
async def extract_poster(request: Request, file: UploadFile = File(...), x_api_key: str = Header(None)):
    await check_rate_limit(request, action="extract", limit=MAX_EXTRACT_PER_HOUR)
    temp_filename = f"temp_{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        result = await ai_service.extract_information(temp_path, x_api_key)
        return result
    except Exception as e:
        logger.error(f"extract_poster error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/extract-text")
async def extract_text(request: Request, req: ExtractTextRequest, x_api_key: str = Header(None)):
    await check_rate_limit(request, action="extract", limit=MAX_EXTRACT_PER_HOUR)
    try:
        result = await ai_service.extract_information_from_text(req.text, x_api_key)
        return result
    except Exception as e:
        logger.error(f"extract_text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/extract-cv")
async def extract_cv(request: Request, file: UploadFile = File(...), x_api_key: str = Header(None)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    await check_rate_limit(request, action="extract", limit=MAX_EXTRACT_PER_HOUR)
    temp_filename = f"cv_{uuid.uuid4()}_{file.filename}"
    temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
    try:
        contents = await file.read()
        with open(temp_path, "wb") as buffer:
            buffer.write(contents)
        text = await ai_service.extract_cv_text(temp_path, x_api_key)
        return {"text": text, "cv_filename": file.filename}
    except Exception as e:
        logger.error(f"extract_cv error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/summarize-cv")
async def summarize_cv(request: Request, payload: dict = Body(...), x_api_key: str = Header(None)):
    cv_text = payload.get("cv_text", "").strip()
    if not cv_text:
        raise HTTPException(status_code=400, detail="cv_text tidak boleh kosong")
    await check_rate_limit(request, action="summarize", limit=20)
    cache_key = make_cv_summary_key(cv_text)
    cached = await cache_get(cache_key)
    if cached:
        return {"summary": cached, "cached": True}
    cv_trimmed = trim_input(cv_text, MAX_CV_RAW_CHARS, "cv_text untuk summarize")
    summarize_prompt = f"""Baca CV berikut dan ekstrak informasi penting ke format JSON.
Balas HANYA dengan JSON valid, tanpa penjelasan, tanpa markdown code block.
Format output:
{{"nama":"nama lengkap","pendidikan":"gelar, jurusan, universitas","pengalaman":["pengalaman 1","pengalaman 2"],"skill_teknis":["skill 1","skill 2","skill 3"],"pencapaian":["pencapaian 1"],"bidang_keahlian":"bidang utama dalam 1 kalimat"}}
Aturan: Maksimal 3 pengalaman, 5 skill, 3 pencapaian. Setiap item maks 15 kata.
CV:
{cv_trimmed}"""
    try:
        raw_result = await ai_service.generate_raw_text(prompt=summarize_prompt, api_key=x_api_key, max_tokens=400)
        try:
            parsed = json.loads(raw_result.strip())
            summary_json = json.dumps(parsed, ensure_ascii=False)
        except json.JSONDecodeError:
            summary_json = raw_result.strip()
        await cache_set(cache_key, summary_json, ttl=CACHE_TTL_CV_SUMMARY)
        return {"summary": summary_json, "cached": False}
    except Exception as e:
        logger.error(f"summarize_cv error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/process-all")
async def process_all(request: Request, x_api_key: str = Header(None)):
    await check_rate_limit(request, action="generate", limit=MAX_GENERATE_PER_HOUR)
    form = await request.form()
    file = form.get("file")
    text_content = form.get("text")
    cv_text = form.get("cv_text", "").strip()
    
    if not cv_text:
        raise HTTPException(status_code=400, detail="CV text is required")
    
    # Safety trim for extreme inputs (silent, no markers)
    cv_text = trim_input(cv_text, MAX_CV_RAW_CHARS, "cv_text_process_all")
    if text_content:
        text_content = trim_input(text_content, MAX_CONTEXT_CHARS, "text_content_process_all")
        
    temp_path = None
    if file and isinstance(file, UploadFile):
        temp_filename = f"all_{uuid.uuid4()}_{file.filename}"
        temp_path = os.path.join(tempfile.gettempdir(), temp_filename)
        contents = await file.read()
        with open(temp_path, "wb") as buffer:
            buffer.write(contents)
            
    try:
        result = await ai_service.process_all_in_one(
            image_path=temp_path, 
            text_content=text_content, 
            cv_text=cv_text, 
            api_key=x_api_key
        )
        return result
    except Exception as e:
        logger.error(f"process_all error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/api/generate")
async def generate_email(request: Request, req: GenerateEmailRequest, x_api_key: str = Header(None)):
    await check_rate_limit(request, action="generate", limit=MAX_GENERATE_PER_HOUR)
    company = req.company_name or "Perusahaan"
    job_title = req.job_title or "Posisi yang Dituju"
    context_trimmed = trim_input(req.context_text, MAX_CONTEXT_CHARS, "context_text")
    cv_trimmed = trim_input(req.cv_text, MAX_CV_RAW_CHARS, "cv_text")
    raw_total_chars = len(req.context_text or "") + len(req.cv_text or "")
    optimized_chars = len(context_trimmed) + len(cv_trimmed)
    cache_key = make_generate_key(company, job_title, context_trimmed, cv_trimmed)
    cached_result = await cache_get(cache_key)
    if cached_result:
        try:
            result = json.loads(cached_result)
        except json.JSONDecodeError:
            result = {"body": cached_result}
        return {**result, "_meta": {"cache_hit": True, "token_saved_estimate": int(raw_total_chars / 4)}}
    try:
        result = await ai_service.generate_email(company_name=company, job_title=job_title, context_text=context_trimmed, cv_text=cv_trimmed, api_key=x_api_key)
        try:
            await cache_set(cache_key, json.dumps(result, ensure_ascii=False))
        except Exception as cache_err:
            logger.warning(f"Cache set failed: {cache_err}")
        chars_saved = raw_total_chars - optimized_chars
        return {**result, "_meta": {"cache_hit": False, "token_saved_estimate": int(chars_saved / 4), "chars_before": raw_total_chars, "chars_after": optimized_chars}}
    except Exception as e:
        logger.error(f"generate_email error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/revise")
async def revise_email(request: Request, req: ReviseEmailRequest, x_api_key: str = Header(None)):
    await check_rate_limit(request, action="generate", limit=MAX_GENERATE_PER_HOUR)
    body_trimmed = trim_input(req.current_body, MAX_REVISE_BODY_CHARS, "current_body")
    instruction = req.instruction.strip()
    revise_cache_key = "sa:rev:" + hashlib.md5(f"{body_trimmed[:200]}|{instruction}".encode()).hexdigest()
    cached = await cache_get(revise_cache_key)
    if cached:
        try:
            result = json.loads(cached)
        except json.JSONDecodeError:
            result = {"body": cached}
        return {**result, "_meta": {"cache_hit": True}}
    try:
        result = await ai_service.revise_email(
            current_body=body_trimmed, 
            instruction=instruction, 
            cv_text=req.cv_text,
            context_text=req.context_text,
            api_key=x_api_key
        )
        try:
            await cache_set(revise_cache_key, json.dumps(result, ensure_ascii=False), ttl=21600)
        except Exception as cache_err:
            logger.warning(f"Revise cache set failed: {cache_err}")
        return {**result, "_meta": {"cache_hit": False}}
    except Exception as e:
        logger.error(f"revise_email error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/copy-to-clipboard")
async def copy_to_clipboard(request: Request, file: UploadFile = File(...)):
    if platform.system() != "Windows":
        return {"status": "skipped", "message": "Feature ini hanya didukung di local Windows environment."}
    
    # Check if this is a form submission (from the "Bridge" trick)
    is_form = "multipart/form-data" in request.headers.get("content-type", "").lower()
    
    try:
        cache_dir = os.path.join(os.getcwd(), "clipboard_cache")
        os.makedirs(cache_dir, exist_ok=True)
        for f in os.listdir(cache_dir):
            try:
                os.remove(os.path.join(cache_dir, f))
            except: pass
            
        file_path = os.path.abspath(os.path.join(cache_dir, file.filename))
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Windows PowerShell Magic
        subprocess.run(["powershell", "-command", f"Set-Clipboard -Path '{file_path}'"], check=True)
        
        if is_form:
            from fastapi.responses import HTMLResponse
            return HTMLResponse(content="""
                <html>
                    <body style="background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-family:sans-serif;">
                        <div style="text-align:center;">
                            <h2 style="color:#22c55e;">✓ CV Copied to System Clipboard</h2>
                            <p>This window will close automatically.</p>
                            <script>setTimeout(() => window.close(), 1000);</script>
                        </div>
                    </body>
                </html>
            """)
        
        return {"status": "success", "message": "File disalin ke clipboard Windows"}
    except Exception as e:
        logger.error(f"copy_to_clipboard error: {e}")
        if is_form:
            from fastapi.responses import HTMLResponse
            return HTMLResponse(content=f"<html><body><h2>Error: {str(e)}</h2><script>setTimeout(() => window.close(), 3000);</script></body></html>")
        return {"status": "error", "message": str(e)}
@app.get("/api/jobs")
async def get_jobs(category: str = "All", search: str = ""):
    logger.info(f"Received request for jobs: category={category}, search={search}")
    try:
        jobs = await supabase_service.get_jobs(category, search)
        logger.info(f"Retrieved {len(jobs)} jobs from Supabase")
        return jobs
    except Exception as e:
        logger.error(f"get_jobs error: {e}")
        return []

@app.post("/api/jobs/scrape")
async def trigger_scrape(request: Request, category: str = "All"):
    await check_rate_limit(request, action="scrape", limit=5)
    try:
        # Auto-cleanup old jobs (30 days)
        cleanup_count = await supabase_service.cleanup_old_jobs(30)
        if cleanup_count > 0:
            logger.info(f"Cleaned up {cleanup_count} old jobs")
        
        if category == "All":
            # Pick 2 random keywords per category for a richer scrape
            tasks = []
            for cat, keywords in scraper_service.CATEGORIES.items():
                selected_kws = random.sample(keywords, min(2, len(keywords)))
                for kw in selected_kws:
                    tasks.append(scraper_service.scrape_jobs(kw, cat))
            
            sem = asyncio.Semaphore(2)
            async def run_task(t):
                async with sem:
                    return await t
                    
            results = await asyncio.gather(*(run_task(t) for t in tasks), return_exceptions=True)
            all_jobs = []
            for res in results:
                if isinstance(res, list): all_jobs.extend(res)
            
            inserted = await supabase_service.insert_jobs(all_jobs)
            return {"status": "success", "count": len(all_jobs), "synced": len(inserted) if inserted else 0}
        else:
            tasks = []
            keywords = scraper_service.CATEGORIES.get(category, [category])
            selected_kws = random.sample(keywords, min(2, len(keywords)))
            for kw in selected_kws:
                tasks.append(scraper_service.scrape_jobs(kw, category))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            all_jobs = []
            for res in results:
                if isinstance(res, list): all_jobs.extend(res)
                
            inserted = await supabase_service.insert_jobs(all_jobs)
            return {"status": "success", "count": len(all_jobs), "synced": len(inserted) if inserted else 0}
    except Exception as e:
        logger.error(f"trigger_scrape error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/jobs/scrape-all")
async def trigger_scrape_all(request: Request):
    await check_rate_limit(request, action="scrape_all", limit=2)
    try:
        # Cleanup first
        await supabase_service.cleanup_old_jobs(30)
        
        jobs = await scraper_service.perform_omni_scrape()
        inserted = await supabase_service.insert_jobs(jobs)
        return {"status": "success", "count": len(jobs), "synced": len(inserted) if inserted else 0}
    except Exception as e:
        logger.error(f"trigger_scrape_all error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/jobs/cleanup")
async def cleanup_old_jobs():
    """Manual trigger to cleanup jobs older than 30 days."""
    try:
        count = await supabase_service.cleanup_old_jobs(30)
        return {"status": "success", "deleted": count}
    except Exception as e:
        logger.error(f"cleanup error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


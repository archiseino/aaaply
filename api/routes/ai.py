import os
import uuid
import tempfile
import shutil
import platform
import subprocess
import json
import hashlib
import logging

from fastapi import APIRouter, UploadFile, File, Header, HTTPException, Body, Request
from fastapi.responses import HTMLResponse

from api.models import ReviseEmailRequest
from api.services import ai_service
from api.core.config import (
    MAX_CONTEXT_CHARS, MAX_CV_RAW_CHARS, MAX_CV_SUMMARY_CHARS, MAX_REVISE_BODY_CHARS,
    MAX_GENERATE_PER_HOUR, MAX_EXTRACT_PER_HOUR, CACHE_TTL_CV_SUMMARY,
)
from api.core.cache import cache_get, cache_set, make_cv_summary_key, make_generate_key
from api.core.utils import trim_input
from api.core.rate_limit import check_rate_limit

logger = logging.getLogger("sobatapply")
router = APIRouter()


@router.post("/api/extract-cv")
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


@router.post("/api/summarize-cv")
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


@router.post("/api/process-all")
async def process_all(request: Request, x_api_key: str = Header(None)):
    await check_rate_limit(request, action="generate", limit=MAX_GENERATE_PER_HOUR)
    form = await request.form()
    file = form.get("file")
    text_content = form.get("text")
    cv_text = form.get("cv_text", "").strip()

    if not cv_text:
        raise HTTPException(status_code=400, detail="CV text is required")

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


@router.post("/api/revise")
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
        return result
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
        return result
    except Exception as e:
        logger.error(f"revise_email error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/copy-to-clipboard")
async def copy_to_clipboard(request: Request, file: UploadFile = File(...)):
    if platform.system() != "Windows":
        return {"status": "skipped", "message": "Feature ini hanya didukung di local Windows environment."}

    is_form = "multipart/form-data" in request.headers.get("content-type", "").lower()

    try:
        cache_dir = os.path.join(os.getcwd(), "clipboard_cache")
        os.makedirs(cache_dir, exist_ok=True)
        for f in os.listdir(cache_dir):
            try:
                os.remove(os.path.join(cache_dir, f))
            except:
                pass

        file_path = os.path.abspath(os.path.join(cache_dir, file.filename))
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        subprocess.run(["powershell", "-command", f"Set-Clipboard -Path '{file_path}'"], check=True)

        if is_form:
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
            return HTMLResponse(content=f"<html><body><h2>Error: {str(e)}</h2><script>setTimeout(() => window.close(), 3000);</script></body></html>")
        return {"status": "error", "message": str(e)}

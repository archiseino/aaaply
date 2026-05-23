import google.generativeai as genai
import json
import PIL.Image
import os
import random
import time
from fastapi import HTTPException
from google.api_core.exceptions import ResourceExhausted, InvalidArgument

def get_backend_keys():
    keys_str = os.environ.get("GEMINI_KEYS", "")
    return [k.strip() for k in keys_str.split(",") if k.strip()]

async def execute_with_retry(api_key: str | None, execute_func):
    """
    Executes the AI task with robust key rotation and failover.
    """
    backend_keys = get_backend_keys()
    target_model = 'gemini-2.5-flash'
    
    async def _try_model(key: str):
        genai.configure(api_key=key)
        try:
            model = genai.GenerativeModel(target_model)
            return await execute_func(model)
        except (ResourceExhausted, InvalidArgument) as e:
            print(f"Key {key[:8]}... failed: {str(e)}")
            raise e

    # 1. User provided key
    if api_key:
        try: return await _try_model(api_key)
        except Exception: pass
            
    # 2. Backend keys fallback
    if not backend_keys:
        raise HTTPException(status_code=401, detail="API Key is required.")
        
    random.shuffle(backend_keys)
    last_error = "All keys failed."
    for key in backend_keys:
        try: return await _try_model(key)
        except Exception as e:
            last_error = str(e)
            continue 
            
    raise HTTPException(status_code=429, detail=f"AI Error: {last_error}")

async def process_all_in_one(image_path: str | None, text_content: str | None, cv_text: str, api_key: str | None):
    """
    The main engine: Extracts job info AND generates professional email in one pass.
    """
    uploaded_files_to_delete = []
    
    try:
        async def _execute(model):
            input_data = []
            source_desc = ""
            if image_path:
                if image_path.lower().endswith('.pdf'):
                    # Use Files API for PDF
                    uploaded = genai.upload_file(path=image_path)
                    
                    # Wait for the file to be processed and ACTIVE
                    while uploaded.state.name == 'PROCESSING':
                        time.sleep(1)
                        uploaded = genai.get_file(uploaded.name)
                    
                    if uploaded.state.name == 'FAILED':
                        raise ValueError("Gemini failed to process the uploaded PDF file.")
                        
                    uploaded_files_to_delete.append(uploaded)
                    input_data.append(uploaded)
                    source_desc = "dokumen pdf lowongan"
                else:
                    # Pass raw bytes directly as inline data to bypass PIL and Files API limitations
                    import mimetypes
                    m_type, _ = mimetypes.guess_type(image_path)
                    if not m_type:
                        m_type = "image/png"
                    with open(image_path, "rb") as f:
                        img_bytes = f.read()
                    image_part = {
                        "mime_type": m_type,
                        "data": img_bytes
                    }
                    input_data.append(image_part)
                    source_desc = "gambar poster lowongan"
            else:
                source_desc = f"teks lowongan: {text_content}"

            prompt = f"""
            TASK / TUGAS: Analyze the job posting ({source_desc}) and generate a professional job application email based on the applicant's CV.

            ============================================================
            CRITICAL STEP 0 — HIGH-ACCURACY OCR SCAN (TRUE CHAIN-OF-THOUGHT)
            ============================================================
            Since the job posting is provided as an image or document, you MUST explicitly write down a thorough transcript of all text elements BEFORE generating the JSON.
            - Read and transcribe small text, headers, footers, contact information, and body text.
            - Pay close attention to email addresses (look for "@" symbols, domains like .com, .id, .co.id, etc.) and job titles.
            - Write the transcript inside <ocr>...</ocr> tags. This is MANDATORY.

            --- APPLICANT CV DATA / DATA CV PELAMAR ---
            {cv_text}
            -----------------------------------------------

            ============================================================
            CRITICAL STEP 1 — LANGUAGE DETECTION (MANDATORY / WAJIB)
            ============================================================
            Before writing ANYTHING, you MUST determine the language of the job posting.
            
            RULES FOR DETECTION / ATURAN DETEKSI:
            - If the job posting is written PRIMARILY in English (title, description, requirements are in English) → the job language is ENGLISH.
            - If the job posting is written PRIMARILY in Bahasa Indonesia (judul, deskripsi, persyaratan dalam Bahasa Indonesia) → the job language is INDONESIAN.
            - Use ONLY the job posting text/image to determine language. Do NOT look at the CV language.
            - When in doubt, look at the job TITLE and REQUIREMENTS section — those determine the language.
            - Mixed postings where the title and main body are English → treat as ENGLISH.
            - Mixed postings where the title and main body are Indonesian → treat as INDONESIAN.

            ============================================================
            CRITICAL STEP 2 — GENERATE IN DETECTED LANGUAGE (ZERO TOLERANCE)
            ============================================================
            Once language is determined, ALL output fields MUST be in that EXACT language:
            
            IF ENGLISH:
            - "subject" → must be in English (e.g., "Application for Senior Engineer - John Doe")
            - "body" → must be ENTIRELY in English. Every sentence, greeting, closing, signature label.
            - Greeting: "Dear Hiring Manager," or "Dear [Name],"
            - Closing: "Best regards," / "Sincerely,"
            - Signature labels: "Email:", "Phone/WhatsApp:"
            - "context_text" → must summarize requirements in English
            - DO NOT use any Indonesian words like "Dengan hormat", "Terima kasih", "Hormat saya", "Perihal", "Lampiran".
            
            IF INDONESIAN:
            - "subject" → must be in Indonesian (e.g., "Lamaran Posisi Staff Teknik - Doni Syahrizal")
            - "body" → must be ENTIRELY in Indonesian. Every sentence, greeting, closing, signature label.
            - Greeting: "Dengan hormat," or "Yth. Bapak/Ibu [Name],"
            - Closing: "Hormat saya," / "Terima kasih,"
            - Signature labels: "Email:", "WhatsApp:"
            - "context_text" → must summarize requirements in Indonesian
            - DO NOT use any English phrases like "Dear Hiring Manager", "Best regards", "I am writing to", "Sincerely".

            ABSOLUTE ZERO TOLERANCE: Do NOT mix languages. If the job is English, writing even ONE Indonesian sentence is a FAILURE. If the job is Indonesian, writing even ONE English sentence is a FAILURE.

            EXCEPTION — NEVER TRANSLATE THESE:
            - JOB TITLE / POSITION NAME: Keep EXACTLY as written in the job posting. Do NOT translate. Example: if the posting says "Staff Teknik", write "Staff Teknik" even in an English email. If it says "Senior Engineer", write "Senior Engineer" even in an Indonesian email.
            - COMPANY NAME: Keep EXACTLY as written in the job posting. Do NOT translate or alter.
            - These are proper nouns / official titles. They must appear verbatim in the subject, body, and all fields.

            ============================================================
            OTHER MANDATORY RULES / ATURAN LAIN YANG WAJIB
            ============================================================
            1. FORMATTING: Return ONLY plain text (PLAIN TEXT). NO markdown (**bold**, # headers, _italic_).
            2. SUBJECT: If the job posting specifies a subject format, use it EXACTLY (Exact Match). Otherwise use: [Position] - [Full Name].
            3. EMAIL BODY: Write 2-3 concise, substantive, professional paragraphs. No filler.
            4. NO BLUFFING: Do NOT fabricate skills or experience not found in the CV.
            5. NAME: Use Title Case (Example: Doni Syahrizal). NEVER use ALL CAPS (DONI SYAHRIZAL).
            6. SIGNATURE: Must include Name, Email, and WhatsApp at the end of the email.
            7. COMPLETENESS — ZERO TOLERANCE FOR TRUNCATION:
               - You MUST write the COMPLETE email body. NEVER truncate, cut, abbreviate, or shorten the content.
               - NEVER use phrases like "[...]" or "[konten dipotong]" or "[continued]" or any truncation markers.
               - NEVER skip content with ellipsis or placeholder text.
               - Write ALL paragraphs fully from start to finish. If you start a sentence, FINISH it.
               - The email body must be a COMPLETE, ready-to-send professional email.

            RETURN YOUR OUTPUT EXACTLY LIKE THIS:
            
            <ocr>
            [Your detailed transcription of the job posting image/document goes here]
            </ocr>

            ```json
            {{
              "detected_language": "ENGLISH or INDONESIAN",
              "hr_email": "HR email from job posting (empty string if not found)",
              "company_name": "company name",
              "job_title": "job position title",
              "context_text": "complete summary of job requirements (in detected language)",
              "subject": "email subject following rules (in detected language)",
              "body": "email body following rules (in detected language)"
            }}
            ```
            """
            input_data.insert(0, prompt)
            config = genai.types.GenerationConfig(max_output_tokens=4096)
            response = model.generate_content(input_data, generation_config=config)
            try:
                text = response.text.strip()
                if "```" in text:
                    text = text.split("```")[1]
                    if text.startswith("json"): text = text[4:]
                return json.loads(text)
            except:
                return {"hr_email": "", "company_name": "Perusahaan", "job_title": "Posisi", "context_text": "", "subject": "Lamaran Kerja", "body": response.text}

        return await execute_with_retry(api_key, _execute)
    finally:
        for f in uploaded_files_to_delete:
            try:
                genai.delete_file(f.name)
            except Exception as e:
                print(f"Failed to delete uploaded poster file {f.name}: {e}")

async def extract_cv_text(file_path: str, api_key: str | None):
    async def _execute(model):
        try:
            uploaded_file = genai.upload_file(path=file_path)
            prompt = "Ekstrak seluruh informasi penting dari CV ini (Nama, Domisili, Pendidikan, IPK, Pengalaman, Skill, Kontak) secara detail untuk pengisian otomatis lamaran kerja."
            response = model.generate_content([uploaded_file, prompt])
            return response.text.strip()
        finally:
            if 'uploaded_file' in locals(): genai.delete_file(uploaded_file.name)
    return await execute_with_retry(api_key, _execute)

async def revise_email(current_body: str, instruction: str, cv_text: str | None, context_text: str | None, api_key: str | None):
    async def _execute(model):
        cv_section = ""
        if cv_text and cv_text.strip():
            cv_section = f"""
        --- DATA CV PELAMAR (WAJIB DIGUNAKAN SEBAGAI REFERENSI) ---
        {cv_text}
        -----------------------------------------------------------"""
        
        context_section = ""
        if context_text and context_text.strip():
            context_section = f"""
        --- KONTEKS LOWONGAN KERJA ---
        {context_text}
        ------------------------------"""

        prompt = f"""
        TASK: Revise this email draft based on the instruction: "{instruction}"
        
        Current Draft / Draf Saat Ini:
        {current_body}
        {cv_section}
        {context_section}
        
        ============================================================
        CRITICAL: LANGUAGE CONSISTENCY (ZERO TOLERANCE)
        ============================================================
        STEP 1: Detect the language of the CURRENT DRAFT above.
        - If the current draft is in English → the revised version MUST be ENTIRELY in English.
        - If the current draft is in Indonesian → the revised version MUST be ENTIRELY in Indonesian.
        - DO NOT switch languages. DO NOT mix languages.
        
        IF CURRENT DRAFT IS ENGLISH:
        - Keep ALL text in English: greeting, body, closing, signature labels.
        - DO NOT introduce Indonesian words (e.g., "Dengan hormat", "Terima kasih", "Hormat saya").
        
        IF CURRENT DRAFT IS INDONESIAN:
        - Keep ALL text in Indonesian: salam, isi, penutup, label tanda tangan.
        - DO NOT introduce English phrases (e.g., "Dear", "Best regards", "I am writing to").
        
        ============================================================
        REVISION RULES / ATURAN REVISI
        ============================================================
        1. Use PLAIN TEXT only (No markdown: no **, no #, no _).
        2. MUST use data from the applicant's CV above. Do NOT fabricate skills or experience.
        3. MUST align with the job posting context above.
        4. Use Title Case for names (e.g., Doni Syahrizal, NOT DONI SYAHRIZAL).
        5. Preserve the signature (Name, Email, WhatsApp) — do not remove it.
        6. ABSOLUTE ZERO TOLERANCE for language mixing. Every single word must be in the same language.
        7. EXCEPTION: NEVER translate job title/position name or company name. Keep them EXACTLY as they appear in the original job posting. These are proper nouns.
        8. COMPLETENESS — ZERO TOLERANCE FOR TRUNCATION:
           - Write the COMPLETE revised email body from start to finish.
           - NEVER truncate, cut, abbreviate, or use markers like "[...]" or "[konten dipotong]".
           - NEVER skip any part of the email. Every paragraph must be complete.
           - The output must be a COMPLETE, ready-to-send professional email.
        
        RETURN ONLY THE REVISED EMAIL BODY (NO EXPLANATIONS, NO EXTRA TEXT).
        """
        config = genai.types.GenerationConfig(max_output_tokens=4096)
        response = model.generate_content(prompt, generation_config=config)
        return {"revised_body": response.text.strip()}
    return await execute_with_retry(api_key, _execute)

async def generate_raw_text(prompt: str, api_key: str | None, max_tokens: int = 400):
    async def _execute(model):
        config = genai.types.GenerationConfig(max_output_tokens=max_tokens)
        response = model.generate_content(prompt, generation_config=config)
        return response.text.strip()
    return await execute_with_retry(api_key, _execute)

async def extract_information(image_path: str, api_key: str | None):
    # Backward compatibility for old calls
    return await process_all_in_one(image_path, None, "", api_key)

async def extract_information_from_text(text_content: str, api_key: str | None):
    # Backward compatibility for old calls
    return await process_all_in_one(None, text_content, "", api_key)

async def generate_email(company_name: str, job_title: str, context_text: str, cv_text: str | None, api_key: str | None):
    # Backward compatibility for old calls
    return await process_all_in_one(None, f"Perusahaan: {company_name}\nPosisi: {job_title}\n{context_text}", cv_text or "", api_key)

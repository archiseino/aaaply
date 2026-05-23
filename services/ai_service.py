import google.generativeai as genai
import json
import PIL.Image
import time

def get_model(api_key: str):
    genai.configure(api_key=api_key)
    return genai.GenerativeModel('gemini-2.5-flash')

async def extract_information(image_path: str, api_key: str):
    model = get_model(api_key)
    prompt = """
    TASK: Analyze this job posting image or document.
    
    ============================================================
    CRITICAL STEP — HIGH-ACCURACY OCR SCAN (TRUE CHAIN-OF-THOUGHT)
    ============================================================
    Since the job posting is provided as an image or document, you MUST explicitly write down a thorough transcript of all text elements BEFORE generating the JSON.
    - Read and transcribe small text, headers, footers, contact information, and body text.
    - Pay close attention to email addresses (look for "@" symbols, domains like .com, .id, .co.id, etc.) and job titles.
    - Write the transcript inside <ocr>...</ocr> tags. This is MANDATORY.
    
    RETURN YOUR OUTPUT EXACTLY LIKE THIS:
    
    <ocr>
    [Your detailed transcription of the image...]
    </ocr>

    ```json
    {
      "hr_email": "HR/destination email (if not found, return empty string)",
      "company_name": "company name",
      "job_title": "offered job position title",
      "context_text": "complete summary of qualifications, requirements, and job description"
    }
    ```
    """
    
    uploaded_file = None
    try:
        if image_path.lower().endswith('.pdf'):
            # Use Files API for PDF
            uploaded_file = genai.upload_file(path=image_path)
            
            while uploaded_file.state.name == 'PROCESSING':
                time.sleep(1)
                uploaded_file = genai.get_file(uploaded_file.name)
                
            if uploaded_file.state.name == 'FAILED':
                raise ValueError("Gemini failed to process the uploaded PDF file.")
                
            response = model.generate_content([prompt, uploaded_file])
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
            response = model.generate_content([prompt, image_part])
        
        text = response.text.strip()
        if "```" in text:
            text = text.split("```")[1]
            if text.startswith("json"): text = text[4:]
        data = json.loads(text)
        return data
    except Exception as e:
        print("Failed to parse JSON from Gemini:", e)
        try:
            raw_text = response.text if 'response' in locals() else str(e)
        except:
            raw_text = str(e)
        return {
            "hr_email": "",
            "company_name": "",
            "job_title": "",
            "context_text": raw_text
        }
    finally:
        if uploaded_file:
            try:
                genai.delete_file(uploaded_file.name)
            except Exception as e:
                print(f"Failed to delete uploaded file {uploaded_file.name}: {e}")

async def extract_information_from_text(text_content: str, api_key: str):
    model = get_model(api_key)
    prompt = f"""
    Analisis teks lowongan kerja berikut:
    ---
    {text_content}
    ---
    
    Tugas Anda adalah mengekstrak informasi penting dan mengembalikannya HANYA dalam format JSON Murni (tanpa tag ```json).
    Format JSON yang diharapkan:
    {{
      "hr_email": "email HR/tujuan (jika tidak ada kembalikan string kosong)",
      "company_name": "nama perusahaan",
      "job_title": "posisi pekerjaan yang ditawarkan",
      "context_text": "ringkasan kualifikasi, syarat, dan deskripsi pekerjaan secara lengkap"
    }}
    """
    
    response = model.generate_content(prompt)
        
    try:
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
        data = json.loads(text)
        return data
    except Exception as e:
        print("Failed to parse JSON from Gemini:", response.text)
        return {
            "hr_email": "",
            "company_name": "",
            "job_title": "",
            "context_text": response.text
        }

async def extract_cv_text(file_path: str, api_key: str):
    genai.configure(api_key=api_key)
    model = get_model(api_key)
    
    try:
        # Upload the PDF file to Gemini
        uploaded_file = genai.upload_file(path=file_path)
        
        prompt = """
        Ekstrak seluruh informasi penting dari CV ini secara detail. 
        Pastikan untuk mengambil:
        1. Nama Lengkap
        2. Email
        3. Nomor Telepon / Kontak
        4. Ringkasan Profil (Professional Summary)
        5. Seluruh Pengalaman Kerja (beserta deskripsi tanggung jawabnya)
        6. Pendidikan
        7. Keterampilan / Skill (Teknis dan Non-Teknis)
        8. Sertifikasi atau penghargaan (jika ada)
        
        Tuliskan hasilnya dalam bentuk teks biasa yang terstruktur dengan baik.
        """
        
        response = model.generate_content([uploaded_file, prompt])
        return response.text.strip()
    except Exception as e:
        print(f"Error extracting CV text via Gemini: {e}")
        raise
    finally:
        # Clean up file from Gemini servers
        if 'uploaded_file' in locals():
            genai.delete_file(uploaded_file.name)

async def generate_email(company_name: str, job_title: str, context_text: str, cv_text: str | None, api_key: str):
    model = get_model(api_key)
    
    cv_instruction = ""
    if cv_text:
        cv_instruction = f"\n    - Informasi CV Pelamar (Gunakan ini untuk mempersonalisasi email dan menonjolkan kualifikasi yang relevan dengan loker):\n    {cv_text}\n"

    prompt = f"""
    Buatkan subject dan body email lamaran kerja yang sangat profesional, modern, dan menarik (tailored to the job).
    
    PENTING (BAHASA):
    Analisis bahasa yang digunakan pada "Detail Kebutuhan" di bawah. Jika loker menggunakan bahasa Inggris, tulis seluruh subject dan body email dalam bahasa Inggris. Jika menggunakan bahasa Indonesia, tulis dalam bahasa Indonesia. Sesuaikan bahasanya 100%.
    
    Informasi Loker:
    - Posisi: {job_title}
    - Perusahaan: {company_name}
    - Detail Kebutuhan: {context_text}
    {cv_instruction}
    
    Kembalikan HANYA format JSON Murni (tanpa tag ```json):
    {{
      "subject": "Application for [Job Title] - [Nama Anda]",
      "body": "Isi email lengkap dari salam pembuka hingga penutup. Gunakan bahasa formal namun tetap humanis. Tinggalkan placeholder seperti [Nama Anda] untuk diisi oleh pengguna."
    }}
    """
    response = model.generate_content(prompt)
    try:
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:-3].strip()
        elif text.startswith("```"):
            text = text[3:-3].strip()
        data = json.loads(text)
        return data
    except Exception as e:
        return {
            "subject": f"Application for {job_title} - [Nama Anda]",
            "body": response.text
        }

async def revise_email(current_body: str, instruction: str, api_key: str):
    model = get_model(api_key)
    prompt = f"""
    Ini adalah draf email lamaran kerja:
    ---
    {current_body}
    ---
    
    Tolong revisi teks email di atas dengan instruksi spesifik berikut: "{instruction}"
    
    KEMBALIKAN HANYA TEKS HASIL REVISI SECARA UTUH. Tidak perlu penjelasan tambahan, tidak perlu JSON.
    """
    response = model.generate_content(prompt)
    return {"revised_body": response.text.strip()}

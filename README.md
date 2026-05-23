# SobatApply

**AI-powered job application assistant.** Upload a job poster image or paste a job description, and SobatApply uses Google Gemini to generate a professional application email tailored to your CV. Also includes a job scraper, application tracker, and Gmail/Outlook direct-send integration.

---

## Architecture

```
sobatapply-monorepo/
├── api/                    # FastAPI backend (routes + services)
│   ├── index.py            # API entry point (endpoints, cache, rate limiting)
│   ├── models.py           # Pydantic schemas
│   └── services/
│       ├── ai_service.py   # Gemini AI integration (email gen, CV extract, revise)
│       ├── scraper_service.py  # Job board scrapers (Bing, Glints, etc.)
│       └── supabase_service.py # Supabase CRUD for jobs
├── frontend/               # React SPA (Vite + Tailwind)
│   └── src/
│       ├── App.tsx          # Main UI
│       ├── components/      # UI components
│       └── utils/           # Gmail/Outlook API, key rotation
├── backend/                # Local server + PyInstaller packaging
│   ├── main.py             # Uvicorn launcher with static file mount
│   ├── launcher.py         # Desktop launcher (opens app in kiosk browser)
│   └── build_exe.py        # PyInstaller build script
├── scripts/                 # Utility scripts
└── services/                # Legacy AI service module
```

---

## Prerequisites

- **Python 3.11+**
- **Node.js 20+**
- **Google Gemini API key** (get one at [aistudio.google.com](https://aistudio.google.com))
- **Supabase project** (optional — for job board persistence)
- **Playwright** (optional — for job scraping)

---

## Local Setup

### 1. Clone & Install Backend

```bash
# Python virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install Python dependencies
pip install -r requirements.txt
```

The `requirements.txt` includes:
- `fastapi`, `uvicorn` — API server
- `google-generativeai` — Gemini AI
- `httpx`, `beautifulsoup4` — HTTP client & scraping
- `playwright`, `playwright-stealth` — browser-based scraping
- `Pillow` — image processing
- `python-dotenv` — environment variables
- `python-multipart` — file uploads

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key
# Or multiple keys for rotation (comma-separated):
GEMINI_KEYS=key1,key2,key3

# Supabase (optional — for job board feature)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# Upstash Redis / Vercel KV (optional — for caching)
KV_REST_API_URL=https://your-region.upstash.io
KV_REST_API_TOKEN=your-token
```

### 3. Install Frontend

```bash
cd frontend
npm install
```

Optionally create `frontend/.env`:
```env
VITE_API_URL=http://localhost:8000
VITE_GMAIL_CLIENT_ID=your-gmail-client-id
VITE_OUTLOOK_CLIENT_ID=your-outlook-client-id
```

### 4. Playwright (for scraping)

Only needed if you plan to run the job scraper locally:

```bash
playwright install chromium
```

### 5. Run the App

**Start backend** (terminal 1):
```bash
python run_backend.py
# Server starts at http://localhost:8000
```

**Start frontend** (terminal 2):
```bash
cd frontend
npm run dev
# Dev server at http://localhost:5173 (proxies /api to :8000)
```

Or use the desktop launcher which starts both in-app browser:
```bash
python backend/launcher.py
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/extract` | Extract job info from image |
| POST | `/api/extract-text` | Extract job info from text |
| POST | `/api/extract-cv` | Extract text from PDF CV |
| POST | `/api/summarize-cv` | Summarize CV into structured JSON |
| POST | `/api/process-all` | Image/text + CV → email (all-in-one) |
| POST | `/api/generate` | Generate email from context + CV |
| POST | `/api/revise` | Revise existing email draft |
| POST | `/api/copy-to-clipboard` | Copy CV file to Windows clipboard |
| GET | `/api/jobs` | List scraped jobs (query: `category`, `search`) |
| POST | `/api/jobs/scrape` | Trigger job scraping |
| POST | `/api/jobs/scrape-all` | Trigger full omni-scrape |
| POST | `/api/jobs/cleanup` | Clean jobs older than 30 days |

---

## Features

- **AI Email Generator** — upload a job poster image or paste a job description; Gemini extracts details and generates a tailored application email in the correct language (EN/ID)
- **CV Management** — upload a PDF CV; extract text, get a structured JSON summary
- **Email Revision** — tell the AI to adjust tone, lengthen, shorten, or rephrase
- **Job Scraper** — scrapes job listings from multiple sources into Supabase; runs daily via GitHub Actions
- **Direct Send** — optional Gmail API & Outlook API integration to send emails directly
- **Application Tracker** — track your applications with statuses locally in the browser
- **Windows Clipboard Bridge** — copy your CV to the clipboard for easy pasting into email attachments
- **Desktop App** — packaged as a portable EXE via PyInstaller

---

## Deployment

### Vercel (Frontend + API)

The `vercel.json` rewrites `/api/*` to the FastAPI app and everything else to `index.html`.

Set environment variables in Vercel Dashboard → Settings → Environment Variables.

### GitHub Actions (Scraper)

The scraper runs daily at 10:00 WIB via `.github/workflows/scrape.yml`. Add `SUPABASE_URL` and `SUPABASE_KEY` as repository secrets.

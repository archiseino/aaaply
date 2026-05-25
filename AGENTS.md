# SobatApply — AI Job Application Assistant

## Tech Stack

- **Backend**: FastAPI (Python 3.11+), Uvicorn
- **Frontend**: React 19 + TypeScript 6 + Vite 8, Tailwind CSS 3, Framer Motion 12
- **Database**: PostgreSQL 16 + PostgREST (local Docker), Supabase (production)
- **Cache**: Upstash KV → local Redis 7 → in-memory dict (3-tier fallback)
- **AI**: Google Gemini (`gemini-2.5-flash`) via `google-generativeai`
- **AI Key Rotation**: Frontend (10 presets) + Backend (`GEMINI_KEYS` env var)
- **Scraping**: httpx + BeautifulSoup4 (lightweight), Playwright (optional)
- **Email**: Gmail API (Google OAuth) + Outlook API (Microsoft Graph/MSAL) — both from browser

## Project Structure

```
api/
├── index.py                  # FastAPI entry point (endpoints, cache, rate limiting)
├── models.py                 # Pydantic schemas
└── services/
    ├── ai_service.py         # Gemini integration
    ├── scraper_service.py    # Job board scrapers (Kalibrr, LinkedIn, Indeed, RemoteOK, Disnakerja)
    └── supabase_service.py   # PostgREST CRUD
frontend/
└── src/
    ├── App.tsx               # Main UI (tabs: Apply, Tracker, JobFinder)
    ├── components/           # UI components
    └── utils/                # gmailApi.ts, outlookApi.ts, apiManager.ts
db/
├── init.sql                  # CREATE TABLE jobs
└── seed.py                   # Sample job data
```

## Development Workflow (TDD)

This project uses **Test-Driven Development**. Always follow Red → Green → Refactor:

1. **Red**: Write a failing test first.
2. **Green**: Write minimal code to make it pass.
3. **Refactor**: Clean up while keeping tests green.

Available skills: `tdd-red`, `tdd-green`, `tdd-refactor`, `test-setup`.

## Commands

```bash
# Dev (both servers)
npm run dev                                    # Start backend (:8000) + frontend (:5173) concurrently

# Backend
python run_backend.py                          # Start API server on :8000
pytest api/tests/ -v                           # Run all backend tests
pytest api/tests/ -v --cov=api                 # Run with coverage
venv\Scripts\activate                          # Windows venv

# Frontend
cd frontend && npm run dev                     # Start dev server on :5173
cd frontend && npx vitest                      # Run all frontend tests
cd frontend && npx vitest --coverage           # Run with coverage
cd frontend && npm run build                   # TypeScript check + build
cd frontend && npm run lint                    # ESLint

# Docker (local DB + cache)
docker compose up -d                           # Start Postgres 16 + PostgREST + Redis 7
docker compose down                            # Stop all

# Seed sample data
python db/seed.py                              # After docker compose up
```

## Environment Variables

Key env vars needed in `.env`:

- `GEMINI_API_KEY` — single Gemini key
- `GEMINI_KEYS` — comma-separated for rotation
- `SUPABASE_URL` / `SUPABASE_KEY` — PostgREST endpoint
- `REDIS_HOST` / `REDIS_PORT` — local Redis
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — Upstash KV (Vercel)
- VITE\_\* vars for frontend OAuth

## Google Sheets Sync Architecture

Sheet is single source of truth. Every mutation auto-syncs. One manual button: ⬇ From Sheets.

### Sheet column mapping (10 columns, B→K)

| Col   | Field             | Backend index                              |
| ----- | ----------------- | ------------------------------------------ |
| B     | No.               | `row[0]` — auto-numbered on append         |
| C     | Nama Perusahaan   | `row[1]` — company                         |
| D     | Posisi            | `row[2]` — job_title                       |
| E     | Lokasi            | `row[3]` — location                        |
| F     | Tanggal Lamar     | `row[4]` — date_applied                    |
| G     | Melamar Lewat     | `row[5]` — method                          |
| **H** | **Email Company** | **`row[6]` — hr_email**                    |
| I     | Status Lamaran    | `row[7]` — formula column (blank on write) |
| J     | Hasil             | `row[8]` — status                          |
| K     | Catatan           | `row[9]` — notes                           |

### Status values (unified, 5 values)

`Applied` | `No Response` | `Interviewing` | `Approve` | `Decline` — same in app and sheet. No mapping at sync boundaries.

### Key files

- `api/services/sheets_service.py` — `SheetsService` class with `read_all_rows`, `append_row`, `update_row`, `delete_row`, `replace_all_rows`. All accept `start_cell` param (default `"B7"`). Uses `_get_sheet_id()` for dynamic sheet ID (fixes "No grid with id: 0" error on template copies).
- `api/models.py` — `SyncAppendRequest` (has `hr_email`), `SyncUpdateRequest` (all fields optional), `SyncDeleteRequest`, `SyncPutRequest`
- `api/index.py` — 5 REST endpoints: `POST/GET/PATCH/DELETE/PUT /api/applications/sync`. `sync_read` backward-compat: extracts email from old `"Email: x"` method values. `_normalize_date()` converts Indonesian dates (`"10 Okt 2024"`) to ISO.
- `frontend/src/utils/sheetsSync.ts` — `syncFromSheets`, `syncAppend` (with `email` field), `syncUpdate` (all fields), `syncDelete`
- `frontend/src/components/SettingsModal.tsx` — Sheet ID + Start Cell (default `"B7"`) config, saved to localStorage
- `frontend/src/components/Tracker.tsx` — 6-column desktop table + mobile card view. Two icons per row: pencil (EditAppModal → PATCH to sheet) + Send (email composer → AI assistant). Delete with confirm modal (different message for synced rows). `onEditSave` prop.

### Auto-sync flow

- **Mount**: auto-loads from sheet via `useEffect` if `SOBAT_SHEET_ID` set
- **Add**: manual, email send, JobFinder import → POST + re-read
- **Status change**: optimistic local update → PATCH → revert on failure
- **Delete**: optimistic local remove → DELETE → revert on failure
- **Edit (modal)**: update local state → PATCH all fields to sheet

## Conventions

- Backend: FastAPI async routes, Pydantic v2 models, services in `api/services/`
- Frontend: Functional React components, Tailwind utility classes, TS strict mode
- AI prompts: Defined inline in `ai_service.py`, language detection (EN/ID) with zero-tolerance mixing
- Rate limiting: Per-IP, per-action (50/hr generate, 100/hr extract, 5/hr scrape)
- Scraper: 28-day data retention, anti-ampas filter for Engineering category
- No `print()` — use `logger` from `api/index.py`

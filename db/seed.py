"""Create tables and seed sample job data into local PostgREST."""
import os
import sys
import subprocess
from pathlib import Path
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

SAMPLE_JOBS = [
    {"title": "Frontend Developer", "company": "TechCorp", "location": "Jakarta", "source": "seed", "url": "https://example.com/jobs/frontend-dev", "description": "Build React UIs for our platform", "category": "Tech", "posted_at": "2026-05-20T08:00:00Z"},
    {"title": "Backend Engineer", "company": "DataFlow", "location": "Remote", "source": "seed", "url": "https://example.com/jobs/backend-eng", "description": "Python + FastAPI microservices", "category": "Tech", "posted_at": "2026-05-19T10:30:00Z"},
    {"title": "UI/UX Designer", "company": "CreativeStudio", "location": "Bandung", "source": "seed", "url": "https://example.com/jobs/ux-designer", "description": "Design user-centric web experiences", "category": "Design", "posted_at": "2026-05-18T09:15:00Z"},
    {"title": "Product Manager", "company": "GrowthInc", "location": "Jakarta", "source": "seed", "url": "https://example.com/jobs/pm", "description": "Own product roadmap and delivery", "category": "Management", "posted_at": "2026-05-17T14:00:00Z"},
    {"title": "Data Analyst", "company": "InsightLab", "location": "Surabaya", "source": "seed", "url": "https://example.com/jobs/data-analyst", "description": "SQL + Python data pipeline analysis", "category": "Tech", "posted_at": "2026-05-16T11:45:00Z"},
    {"title": "Marketing Lead", "company": "BrandWave", "location": "Remote", "source": "seed", "url": "https://example.com/jobs/marketing-lead", "description": "Lead digital marketing campaigns", "category": "Marketing", "posted_at": "2026-05-15T08:30:00Z"},
]

def ensure_tables():
    sql_path = Path(__file__).parent / "init.sql"
    if not sql_path.exists():
        print(f"Missing init.sql at {sql_path}")
        return False
    try:
        result = subprocess.run(
            ["docker", "exec", "-i", "sobatapply-postgres", "psql", "-U", "postgres", "-d", "sobatapply"],
            input=sql_path.read_text(),
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode != 0:
            print(f"Table creation failed: {result.stderr.strip()}")
            return False
        print("Tables ready")
        return True
    except FileNotFoundError:
        print("Docker not found — install Docker or run db/init.sql manually against your Postgres")
        return False
    except subprocess.TimeoutExpired:
        print("Docker exec timed out — is the container running?")
        return False

def seed_data(url: str, key: str):
    headers = {
        "apikey": key or "",
        "Authorization": f"Bearer {key or ''}",
        "Content-Type": "application/json",
        "Prefer": "return=representation, resolution=merge-duplicates",
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(f"{url}/jobs?on_conflict=url", headers=headers, json=SAMPLE_JOBS)
        if response.status_code in (200, 201):
            data = response.json()
            print(f"Seeded {len(data) if isinstance(data, list) else 1} jobs")
        else:
            print(f"Seed error: {response.status_code} — {response.text[:300]}")

def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url:
        print("Set SUPABASE_URL and SUPABASE_KEY, e.g.:")
        print("  SUPABASE_URL=http://localhost:3000 SUPABASE_KEY=local-dev-key python db/seed.py")
        sys.exit(1)

    if ensure_tables():
        seed_data(url, key)

if __name__ == "__main__":
    main()

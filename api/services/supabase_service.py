"""
SobatApply Supabase Service
============================
- Job data persistence with Supabase
- Auto-cleanup for jobs older than 28 days
- Robust upsert with fallback
"""
import os
import httpx
from datetime import datetime, timedelta
from typing import List, Optional
from ..models import ScrapedJob
import logging

class SupabaseService:
    def __init__(self):
        self.logger = logging.getLogger("sobatapply.supabase")

    def _get_credentials(self):
        return os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")

    def _is_ready(self) -> bool:
        url, key = self._get_credentials()
        if not url or not key:
            self.logger.error("Supabase credentials missing!")
            return False
        return True

    def _get_headers(self):
        _, key = self._get_credentials()
        return {
            "apikey": key or "",
            "Authorization": f"Bearer {key or ''}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def _get_base_url(self):
        url, _ = self._get_credentials()
        return f"{url}/rest/v1" if url else ""

    async def get_jobs(self, category: str = "All", search: str = "") -> List[dict]:
        if not self._is_ready(): return []
        
        # Sort by posted_at descending to show newest jobs first
        params = {"select": "*", "order": "posted_at.desc", "limit": "10000"}
        if category != "All": params["category"] = f"eq.{category}"
        if search: params["or"] = f"(title.ilike.*{search}*,company.ilike.*{search}*,location.ilike.*{search}*)"
            
        try:
            all_jobs = []
            async with httpx.AsyncClient(timeout=15.0) as client:
                for offset in range(0, 10000, 1000):
                    params["offset"] = str(offset)
                    params["limit"] = "1000"
                    response = await client.get(f"{self._get_base_url()}/jobs", headers=self._get_headers(), params=params)
                    response.raise_for_status()
                    data = response.json()
                    all_jobs.extend(data)
                    
                    # Stop if we got less than 1000 items (meaning we reached the end)
                    if len(data) < 1000:
                        break
                        
                return all_jobs
        except Exception as e:
            self.logger.error(f"Supabase GET error: {str(e)}")
            return []

    async def insert_jobs(self, jobs: List[ScrapedJob]) -> List[dict]:
        if not self._is_ready() or not jobs:
            return []
        
        # PostgREST Upsert
        upsert_headers = self._get_headers()
        upsert_headers["Prefer"] = "return=representation, resolution=merge-duplicates"
        
        # Deduplicate
        unique_data = []
        seen_urls = set()
        for job in jobs:
            clean_url = job.url.split('?')[0].rstrip('/') if job.url else ""
            if clean_url and clean_url not in seen_urls:
                seen_urls.add(clean_url)
                job_dict = job.dict(exclude={"id"})
                job_dict["url"] = clean_url  # Ensure clean URL
                unique_data.append(job_dict)
        
        if not unique_data: return []
        
        # Send in batches of 50 to avoid payload limits
        all_inserted = []
        for i in range(0, len(unique_data), 50):
            batch = unique_data[i:i+50]
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    self.logger.info(f"Upserting batch {i//50 + 1}: {len(batch)} jobs...")
                    response = await client.post(
                        f"{self._get_base_url()}/jobs?on_conflict=url",
                        headers=upsert_headers,
                        json=batch
                    )
                    
                    if response.status_code not in [200, 201]:
                        self.logger.warning(f"Upsert failed ({response.status_code}): {response.text[:200]}")
                        # Fallback: try normal POST
                        normal_headers = self._get_headers()
                        response = await client.post(
                            f"{self._get_base_url()}/jobs",
                            headers=normal_headers,
                            json=batch
                        )
                    
                    if response.status_code in [200, 201]:
                        data = response.json()
                        all_inserted.extend(data if isinstance(data, list) else [data])
                        self.logger.info(f"Batch synced: {len(data) if isinstance(data, list) else 1} jobs")
                    else:
                        self.logger.error(f"Batch rejected: {response.text[:200]}")
            except Exception as e:
                self.logger.error(f"Supabase insert error: {str(e)}")
        
        return all_inserted

    async def cleanup_old_jobs(self, days: int = 28) -> int:
        """Delete jobs older than N days from the database."""
        if not self._is_ready(): return 0
        
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%S")
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                # Delete jobs where posted_at is older than cutoff
                delete_headers = self._get_headers()
                delete_headers["Prefer"] = "return=representation"
                
                response = await client.delete(
                    f"{self._get_base_url()}/jobs?posted_at=lt.{cutoff}",
                    headers=delete_headers
                )
                
                if response.status_code in [200, 204]:
                    deleted = response.json() if response.text else []
                    count = len(deleted) if isinstance(deleted, list) else 0
                    self.logger.info(f"Cleaned up {count} jobs older than {days} days")
                    return count
                else:
                    self.logger.warning(f"Cleanup failed: {response.status_code} - {response.text[:200]}")
                    return 0
        except Exception as e:
            self.logger.error(f"Cleanup error: {str(e)}")
            return 0

supabase_service = SupabaseService()

import asyncio
import random
import logging

from fastapi import APIRouter, HTTPException, Request

from api.services import supabase_service, scraper_service
from api.core.rate_limit import check_rate_limit

logger = logging.getLogger("sobatapply")
router = APIRouter()


@router.get("/api/jobs")
async def get_jobs(category: str = "All", search: str = ""):
    logger.info(f"Received request for jobs: category={category}, search={search}")
    try:
        jobs = await supabase_service.get_jobs(category, search)
        logger.info(f"Retrieved {len(jobs)} jobs from Supabase")
        return jobs
    except Exception as e:
        logger.error(f"get_jobs error: {e}")
        return []


@router.post("/api/jobs/scrape")
async def trigger_scrape(request: Request, category: str = "All"):
    await check_rate_limit(request, action="scrape", limit=5)
    try:
        cleanup_count = await supabase_service.cleanup_old_jobs(30)
        if cleanup_count > 0:
            logger.info(f"Cleaned up {cleanup_count} old jobs")

        if category == "All":
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
                if isinstance(res, list):
                    all_jobs.extend(res)

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
                if isinstance(res, list):
                    all_jobs.extend(res)

            inserted = await supabase_service.insert_jobs(all_jobs)
            return {"status": "success", "count": len(all_jobs), "synced": len(inserted) if inserted else 0}
    except Exception as e:
        logger.error(f"trigger_scrape error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

import asyncio
import os
import sys

# Add the project root to sys.path so we can import api modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.services.scraper_service import scraper_service
from api.services.supabase_service import supabase_service
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("run_scraper")

async def main():
    logger.info("Starting omni-scrape...")
    
    # Optional: cleanup old jobs before scraping
    cleanup_count = await supabase_service.cleanup_old_jobs(30)
    logger.info(f"Cleaned up {cleanup_count} old jobs")
    
    jobs = await scraper_service.perform_omni_scrape()
    logger.info(f"Scrape finished. Found {len(jobs)} unique jobs.")
    
    if jobs:
        inserted = await supabase_service.insert_jobs(jobs)
        logger.info(f"Successfully inserted {len(inserted) if inserted else 0} jobs into Supabase.")
    else:
        logger.info("No jobs to insert.")

if __name__ == "__main__":
    asyncio.run(main())

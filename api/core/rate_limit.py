import logging

from fastapi import HTTPException, Request

from api.core.cache import cache_incr, make_rate_limit_key
from api.core.config import CACHE_TTL_RATE_LIMIT, MAX_GENERATE_PER_HOUR

logger = logging.getLogger("sobatapply")


async def check_rate_limit(request: Request, action: str = "generate", limit: int = MAX_GENERATE_PER_HOUR) -> None:
    ip = request.headers.get("x-forwarded-for", "unknown").split(",")[0].strip()
    key = make_rate_limit_key(ip, action)
    count = await cache_incr(key, ttl=CACHE_TTL_RATE_LIMIT)
    if count > limit:
        logger.warning(f"Rate limit hit: ip={ip} action={action} count={count}")
        raise HTTPException(status_code=429, detail=f"Terlalu banyak permintaan. Batas: {limit} per jam.", headers={"Retry-After": "3600"})

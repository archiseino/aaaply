import os
import time
import hashlib
import logging

import redis as _redis

logger = logging.getLogger("sobatapply")

kv = None
KV_AVAILABLE = False
try:
    from upstash_redis import Redis as UpstashRedis
    _KV_URL = os.environ.get("KV_REST_API_URL")
    _KV_TOKEN = os.environ.get("KV_REST_API_TOKEN")
    if _KV_URL and _KV_TOKEN:
        kv = UpstashRedis(url=_KV_URL, token=_KV_TOKEN)
        KV_AVAILABLE = True
        logger.info("Vercel KV (Upstash Redis) connected")
except ImportError:
    pass

_REDIS_HOST = os.environ.get("REDIS_HOST")
_REDIS_PORT = int(os.environ.get("REDIS_PORT", "6379"))
local_redis = None
LOCAL_REDIS_AVAILABLE = False
if _REDIS_HOST:
    try:
        local_redis = _redis.Redis(host=_REDIS_HOST, port=_REDIS_PORT, db=0, socket_connect_timeout=2)
        local_redis.ping()
        LOCAL_REDIS_AVAILABLE = True
        logger.info(f"Local Redis connected at {_REDIS_HOST}:{_REDIS_PORT}")
    except Exception as e:
        logger.warning(f"Local Redis connection failed: {e}")

_memory_cache: dict[str, tuple[str, float]] = {}
MEMORY_CACHE_MAX = 200

def _memory_get(key: str) -> str | None:
    if key not in _memory_cache:
        return None
    value, expire_at = _memory_cache[key]
    if time.time() > expire_at:
        del _memory_cache[key]
        return None
    return value

def _memory_set(key: str, value: str, ttl_seconds: int = 86400) -> None:
    if len(_memory_cache) >= MEMORY_CACHE_MAX:
        del _memory_cache[next(iter(_memory_cache))]
    _memory_cache[key] = (value, time.time() + ttl_seconds)

from api.core.config import CACHE_TTL_GENERATE, CACHE_TTL_RATE_LIMIT

async def cache_get(key: str) -> str | None:
    if KV_AVAILABLE:
        try:
            return kv.get(key)
        except Exception as e:
            logger.error(f"KV get error: {e}")
    if LOCAL_REDIS_AVAILABLE:
        try:
            val = local_redis.get(key)
            return val.decode() if val is not None else None
        except Exception as e:
            logger.error(f"Local Redis get error: {e}")
    return _memory_get(key)

async def cache_set(key: str, value: str, ttl: int = CACHE_TTL_GENERATE) -> None:
    if KV_AVAILABLE:
        try:
            kv.set(key, value, ex=ttl)
            return
        except Exception as e:
            logger.error(f"KV set error: {e}")
    if LOCAL_REDIS_AVAILABLE:
        try:
            local_redis.set(key, value, ex=ttl)
            return
        except Exception as e:
            logger.error(f"Local Redis set error: {e}")
    _memory_set(key, value, ttl)

async def cache_incr(key: str, ttl: int = CACHE_TTL_RATE_LIMIT) -> int:
    if KV_AVAILABLE:
        try:
            val = kv.incr(key)
            if val == 1:
                kv.expire(key, ttl)
            return val
        except Exception as e:
            logger.error(f"KV incr error: {e}")
    if LOCAL_REDIS_AVAILABLE:
        try:
            val = local_redis.incr(key)
            if val == 1:
                local_redis.expire(key, ttl)
            return val
        except Exception as e:
            logger.error(f"Local Redis incr error: {e}")
    raw = _memory_get(key)
    count = (int(raw) + 1) if raw else 1
    _memory_set(key, str(count), ttl)
    return count

def make_generate_key(company: str, job_title: str, context: str, cv_snippet: str) -> str:
    raw = f"gen|{company.lower()}|{job_title.lower()}|{context[:100]}|{cv_snippet[:100]}"
    return "sa:" + hashlib.md5(raw.encode()).hexdigest()

def make_cv_summary_key(cv_text: str) -> str:
    return "sa:cvsum:" + hashlib.md5(cv_text[:200].encode()).hexdigest()

def make_rate_limit_key(ip: str, action: str) -> str:
    return f"sa:rl:{action}:{ip}"

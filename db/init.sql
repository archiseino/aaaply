CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title       TEXT NOT NULL,
    company     TEXT NOT NULL,
    location    TEXT NOT NULL,
    source      TEXT NOT NULL DEFAULT 'manual',
    url         TEXT UNIQUE NOT NULL,
    description TEXT,
    email       TEXT,
    image_url   TEXT,
    category    TEXT NOT NULL DEFAULT 'All',
    posted_at   TIMESTAMPTZ,
    scraped_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs (posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs (category);

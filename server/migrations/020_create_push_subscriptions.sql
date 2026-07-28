-- Durable Web Push subscriptions (survives Render redeploys).
-- JSON file remains local-dev fallback when DATABASE_URL is unset.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  keys JSONB NOT NULL,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_email
  ON push_subscriptions (email);

CREATE TABLE IF NOT EXISTS push_dispatch_fingerprints (
  fingerprint TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_dispatch_fingerprints_created_at
  ON push_dispatch_fingerprints (created_at DESC);

-- Lock down PostgREST (emails + push keys).
ALTER TABLE IF EXISTS push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS push_dispatch_fingerprints ENABLE ROW LEVEL SECURITY;

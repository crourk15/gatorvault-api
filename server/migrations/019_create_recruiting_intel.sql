-- Durable recruiting intel (beat visits, predictions, OV changes).
-- Survives Render redeploys; JSON file remains local-dev fallback.

CREATE TABLE IF NOT EXISTS recruiting_intel (
  fingerprint TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  player_id TEXT,
  player_slug TEXT,
  player_name TEXT,
  event_type TEXT,
  reported_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruiting_intel_reported_at
  ON recruiting_intel (reported_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_recruiting_intel_player_slug
  ON recruiting_intel (player_slug);

CREATE INDEX IF NOT EXISTS idx_recruiting_intel_event_type
  ON recruiting_intel (event_type);

-- Lock down PostgREST.
ALTER TABLE IF EXISTS recruiting_intel ENABLE ROW LEVEL SECURITY;

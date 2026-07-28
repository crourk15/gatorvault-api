-- Autoposter ledgers — survive Render redeploys when DATABASE_URL is set.

CREATE TABLE IF NOT EXISTS autoposter_sent_ledger (
  id BIGSERIAL PRIMARY KEY,
  player_slug TEXT,
  intel_fingerprint TEXT,
  text_hash_norm TEXT,
  tweet_id TEXT,
  sent_at TIMESTAMPTZ,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autoposter_sent_slug ON autoposter_sent_ledger (player_slug);
CREATE INDEX IF NOT EXISTS idx_autoposter_sent_at ON autoposter_sent_ledger (sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_autoposter_sent_fp
  ON autoposter_sent_ledger (intel_fingerprint)
  WHERE intel_fingerprint IS NOT NULL AND intel_fingerprint <> '';

CREATE TABLE IF NOT EXISTS autoposter_player_resolution (
  player_slug TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS autoposter_sent_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS autoposter_player_resolution ENABLE ROW LEVEL SECURITY;

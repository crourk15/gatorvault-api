-- Postgres persistence for detectives pile + autoposter queue (survives Render deploys).

CREATE TABLE IF NOT EXISTS autoposter_detectives_doc (
  id TEXT PRIMARY KEY DEFAULT 'default',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS autoposter_queue_doc (
  id TEXT PRIMARY KEY DEFAULT 'default',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_autoposter_detectives_doc_updated
  ON autoposter_detectives_doc (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_autoposter_queue_doc_updated
  ON autoposter_queue_doc (updated_at DESC);

-- Subscriber email alert preferences (visit digest + tracked players).

CREATE TABLE IF NOT EXISTS alert_email_preferences (
  email TEXT PRIMARY KEY,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alert_email_preferences_updated_at
  ON alert_email_preferences (updated_at DESC);

-- Lock down PostgREST (subscriber emails).
ALTER TABLE IF EXISTS alert_email_preferences ENABLE ROW LEVEL SECURITY;

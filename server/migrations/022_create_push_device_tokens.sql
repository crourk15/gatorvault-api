-- Native APNs / FCM device tokens for Capacitor shell push.

CREATE TABLE IF NOT EXISTS push_device_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_device_tokens_email
  ON push_device_tokens (email);

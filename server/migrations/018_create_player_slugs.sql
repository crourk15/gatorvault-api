-- Canonical slug aliases for O(1) player resolution (no client-side slug guessing).
-- Seed primary slugs from futurecast.players.

CREATE TABLE IF NOT EXISTS futurecast.player_slugs (
  id          SERIAL PRIMARY KEY,
  player_id   UUID NOT NULL REFERENCES futurecast.players (id) ON DELETE CASCADE,
  slug        TEXT NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT player_slugs_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_player_slugs_player_id
  ON futurecast.player_slugs (player_id);

CREATE INDEX IF NOT EXISTS idx_player_slugs_slug_lower
  ON futurecast.player_slugs (lower(slug));

INSERT INTO futurecast.player_slugs (player_id, slug, is_primary)
SELECT p.id, p.slug, true
FROM futurecast.players p
ON CONFLICT (slug) DO NOTHING;

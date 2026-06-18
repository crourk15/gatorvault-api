/**
 * player_slugs — fast slug → player_id resolution.
 */
import { db } from './db';
import { getPlayerById, getPlayerBySlug } from './player';

export interface PlayerSlugRow {
  playerId: string;
  slug: string;
  isPrimary: boolean;
}

export async function getPlayerIdBySlug(slug: string): Promise<PlayerSlugRow | null> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const { rows } = await db.query<{
    player_id: string;
    slug: string;
    is_primary: boolean;
  }>(
    `
    SELECT player_id, slug, is_primary
    FROM futurecast.player_slugs
    WHERE lower(slug) = $1
    LIMIT 1
    `,
    [normalized]
  );

  if (!rows.length) return null;
  return {
    playerId: rows[0].player_id,
    slug: rows[0].slug,
    isPrimary: rows[0].is_primary,
  };
}

export async function ensurePlayerSlugAlias(
  playerId: string,
  slug: string,
  isPrimary = false
): Promise<void> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return;

  await db.query(
    `
    INSERT INTO futurecast.player_slugs (player_id, slug, is_primary)
    VALUES ($1, $2, $3)
    ON CONFLICT (slug) DO NOTHING
    `,
    [playerId, normalized, isPrimary]
  );
}

/** Resolve slug → Postgres player id (player_slugs, then players.slug). */
export async function resolvePostgresPlayerBySlug(
  slug: string
): Promise<{ playerId: string; canonicalSlug: string } | null> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  const alias = await getPlayerIdBySlug(normalized);
  if (alias) {
    const player = await getPlayerById(alias.playerId);
    if (player) {
      return { playerId: player.id, canonicalSlug: player.slug };
    }
  }

  const direct = await getPlayerBySlug(normalized);
  if (direct) {
    await ensurePlayerSlugAlias(direct.id, direct.slug, true);
    if (normalized !== direct.slug) {
      await ensurePlayerSlugAlias(direct.id, normalized, false);
    }
    return { playerId: direct.id, canonicalSlug: direct.slug };
  }

  return null;
}

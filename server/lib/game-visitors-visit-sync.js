/**
 * After a home game kicks off, published visitor-list slugs become Florida
 * unofficial campus visits — Chase / Closest / allowlist read visit_logs,
 * not the editorial Game Week label.
 *
 * Expected lists stay labels until the game date. Do not invent trips.
 * Skip commits to other schools. 2027 is never auto-promoted.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const visitLogStore = require('./recruiting-visit-log-store');
const { isFloridaSchool } = require('./recruiting-target-filters');

const DOC_PATH = path.join(__dirname, '..', 'data', 'schedule', 'game-visitors-2026.json');

/** Known committed-elsewhere on the FAU expected list — do not score as UF process. */
const SKIP_SLUGS = new Set([
  'chayse-brown', // FSU commit (Alderman / GatorCountry)
  'anthony-blalock-jr', // Alabama commit
]);

function loadDoc() {
  try {
    return JSON.parse(fs.readFileSync(DOC_PATH, 'utf8'));
  } catch {
    return { games: [], visitorMeta: {} };
  }
}

function parseGameDate(game, seasonYear = 2026) {
  const explicit = String(game?.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(explicit)) return explicit;
  const label = String(game?.dateLabel || '').trim();
  const m = label.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
  if (!m) return null;
  const months = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
  };
  const mm = months[m[1]];
  if (!mm) return null;
  return `${seasonYear}-${mm}-${String(m[2]).padStart(2, '0')}`;
}

function gameHasBeenPlayed(game, nowMs = Date.now(), seasonYear = 2026) {
  const day = parseGameDate(game, seasonYear);
  if (!day) return false;
  // After local calendar day in ET (kickoff windows are evening).
  const end = Date.parse(`${day}T23:59:59-04:00`);
  return Number.isFinite(end) && nowMs > end;
}

function committedElsewhere(player) {
  if (!player) return false;
  const to = String(player.committedTo || player.committed_to || '').trim();
  if (!to) return false;
  if (isFloridaSchool(to)) return false;
  return true;
}

function displayName(slug, meta, player) {
  return (
    String(meta?.name || player?.name || player?.fullName || '')
      .trim() ||
    String(slug || '')
      .split('-')
      .map((w) => (w.length <= 2 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
  );
}

async function ensureVisitorPlayerRow(store, { slug, name, year, meta, player }) {
  if (player) {
    const yearNow = Number(player.classYear) || year;
    if (yearNow === 2028 && String(player.category || '').toLowerCase() === 'recruit' && !committedElsewhere(player)) {
      return store.upsertPlayer({
        ...player,
        slug,
        name: player.name || name,
        classYear: 2028,
        category: 'target',
        status: player.status || 'uncommitted',
      });
    }
    return player;
  }
  if (year !== 2028) return null;
  const school = String(meta?.school || '').trim();
  return store.upsertPlayer({
    slug,
    name,
    classYear: 2028,
    pos: meta?.position || 'ATH',
    school: school || null,
    stars: meta?.stars != null && Number(meta.stars) > 0 ? Number(meta.stars) : null,
    category: 'target',
    status: 'uncommitted',
    inState: /,\s*FL\b|\(FL\)|\bFL\b/i.test(school),
  });
}

/**
 * Persist completed home-game visitor lists into visit_logs.
 * @returns {Promise<{ created: object[], skipped: object[], promoted: object[] }>}
 */
async function syncPlayedGameVisitors({ dryRun = false, nowMs = Date.now(), seasonYear = 2026 } = {}) {
  const doc = loadDoc();
  const meta = doc.visitorMeta && typeof doc.visitorMeta === 'object' ? doc.visitorMeta : {};
  const store = require('./recruiting-store');
  const created = [];
  const skipped = [];
  const promoted = [];

  for (const game of Array.isArray(doc.games) ? doc.games : []) {
    if (!gameHasBeenPlayed(game, nowMs, seasonYear)) {
      skipped.push({ gameId: game.gameId, reason: 'not_played' });
      continue;
    }
    const day = parseGameDate(game, seasonYear);
    const slugs = Array.isArray(game.slugs) ? game.slugs : [];
    for (const raw of slugs) {
      const slug = String(raw || '')
        .trim()
        .toLowerCase();
      if (!slug) continue;
      if (SKIP_SLUGS.has(slug)) {
        skipped.push({ slug, reason: 'committed_elsewhere' });
        continue;
      }
      let player = typeof store.findBySlug === 'function' ? store.findBySlug(slug) : null;
      if (committedElsewhere(player)) {
        skipped.push({ slug, reason: 'committed_elsewhere' });
        continue;
      }
      const year = Number(meta[slug]?.classYear || player?.classYear) || 2028;
      if (year === 2027) {
        skipped.push({ slug, reason: 'no_2027_auto' });
        continue;
      }
      const name = displayName(slug, meta[slug], player);
      const detail = `${name} — Florida unofficial visit (game day vs ${game.opponent || game.gameId}, ${day}).`;
      if (dryRun) {
        created.push({ slug, day, dryRun: true, classYear: year });
        continue;
      }
      try {
        player = (await ensureVisitorPlayerRow(store, { slug, name, year, meta: meta[slug], player })) || player;
      } catch (err) {
        skipped.push({
          slug,
          reason: 'player_upsert_failed',
          error: err instanceof Error ? err.message : String(err),
        });
      }
      const out = visitLogStore.appendVisitLog({
        playerSlug: slug,
        playerId: player?.on3Id || player?.id || null,
        playerName: name,
        school: 'Florida',
        visitType: 'unofficial_visit',
        date: day,
        source: 'game-visitors',
        detail,
      });
      if (out.created) created.push({ slug, day, fingerprint: out.item?.fingerprint });
      else skipped.push({ slug, reason: out.duplicate ? 'duplicate' : out.reason || 'skip' });

      if (year === 2028 && (out.created || out.duplicate)) {
        try {
          const { promoteAllowlistOnCampusVisit } = require('./campus-visit-allowlist-promote');
          const promo = await promoteAllowlistOnCampusVisit({
            slug,
            name,
            classYear: 2028,
            player: {
              ...(player || {}),
              slug,
              name,
              classYear: 2028,
              on3Slug: player?.on3Slug || slug,
              visits: [{ school: 'Florida', visitType: 'unofficial_visit', date: day }],
            },
          });
          if (promo.promoted) promoted.push({ slug, ...promo });
        } catch (err) {
          skipped.push({
            slug,
            reason: 'promote_failed',
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  return {
    created,
    skipped,
    promoted,
    createdCount: created.length,
    promotedCount: promoted.length,
  };
}

module.exports = {
  DOC_PATH,
  SKIP_SLUGS,
  parseGameDate,
  gameHasBeenPlayed,
  syncPlayedGameVisitors,
};

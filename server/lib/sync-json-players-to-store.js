/**
 * Push canonical player rows from server/data/recruiting/players.json into the live store (Supabase when configured).
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');

const PLAYERS_PATH = path.join(__dirname, '..', 'data', 'recruiting', 'players.json');

function loadPlayersJson() {
  return JSON.parse(fs.readFileSync(PLAYERS_PATH, 'utf8'));
}

function sanitizeForSync(player) {
  const p = { ...player };
  if (String(p.status || '').toLowerCase() === 'uncommitted') {
    p.committedTo = null;
    p.fromSchool = null;
    p.commitDate = null;
  }
  if (p.school === '') p.school = null;
  if (p.htWt === '') p.htWt = null;
  return p;
}

async function syncSlugsFromJson(slugs, options = {}) {
  const wanted = new Set((slugs || []).map((s) => String(s).trim().toLowerCase()).filter(Boolean));
  if (!wanted.size) {
    throw new Error('At least one slug is required');
  }

  const all = loadPlayersJson();
  const bySlug = new Map(all.map((p) => [String(p.slug || '').toLowerCase(), p]));
  const results = [];

  for (const slug of wanted) {
    const raw = bySlug.get(slug);
    if (!raw) {
      results.push({ slug, ok: false, error: 'not_in_players_json' });
      continue;
    }
    try {
      const patch = sanitizeForSync(raw);
      const saved = await store.upsertPlayer(patch, { subsystem: 'json-slug-sync' });
      results.push({
        slug,
        ok: true,
        category: saved?.category,
        status: saved?.status,
        committedTo: saved?.committedTo ?? null,
      });
    } catch (err) {
      results.push({ slug, ok: false, error: err.message });
    }
  }

  let hubWarm = null;
  if (options.warmHub !== false) {
    try {
      const { warmEliteHubCaches } = require('./recruiting-hub-cache');
      hubWarm = await warmEliteHubCaches();
    } catch (err) {
      hubWarm = { ok: false, error: err.message };
    }
  }

  const board2027 = await store.getBoard(2027);
  return {
    ok: results.every((r) => r.ok),
    storage: store.storageMode(),
    synced: results,
    board2027: {
      targetCount: board2027.targets.length,
      slugs: board2027.targets.map((p) => p.slug),
    },
    hubWarm,
  };
}

module.exports = { syncSlugsFromJson, sanitizeForSync, loadPlayersJson };
/**
 * Purge UF coaching-staff identities that were soft-created as HS/FutureCast
 * "recruits" (e.g. brandon-harris = CB coach hydrated with Asher Ghioto data).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  listStaff,
  isStaffPlayerSlug,
  isStaffOrCoachName,
  STAFF_ID_ALIASES,
} = require('./recruiting-staff-directory');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');

function staffPhantomSlugs() {
  const out = new Set();
  for (const entry of listStaff()) {
    const id = String(entry.staffId || '').toLowerCase();
    if (id) out.add(id);
    const nameSlug = String(entry.name || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (nameSlug) out.add(nameSlug);
  }
  for (const [alias, target] of Object.entries(STAFF_ID_ALIASES)) {
    const a = String(alias || '')
      .toLowerCase()
      .replace(/\s+/g, '-');
    if (a) out.add(a);
    if (target) out.add(String(target).toLowerCase());
  }
  // Explicit coach phantoms seen in the wild.
  out.add('brandon-harris');
  out.add('phil-trautwein');
  out.add('chris-foster');
  // Also scrub alumni/roster bleed that soft-created onto 2028 chase.
  try {
    const { BLOCKED_PLAYER_SLUGS } = require('./recruiting-blocked-players');
    for (const slug of BLOCKED_PLAYER_SLUGS) out.add(slug);
  } catch {
    /* optional */
  }
  return [...out];
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function isPhantomPlayer(row) {
  if (!row) return false;
  const slug = String(row.slug || row.id || '').toLowerCase();
  const name = String(row.name || row.playerName || '').trim();
  if (slug && isStaffPlayerSlug(slug)) return true;
  if (name && isStaffOrCoachName(name)) return true;
  try {
    const { isBlockedRecruit } = require('./recruiting-blocked-players');
    if (isBlockedRecruit(row)) return true;
  } catch {
    /* optional */
  }
  return false;
}

function purgePlayersArray(filePath) {
  const players = readJson(filePath, null);
  if (!Array.isArray(players)) return { removed: 0, slugs: [] };
  const removed = [];
  const next = players.filter((p) => {
    if (isPhantomPlayer(p)) {
      removed.push(String(p.slug || p.id || p.name || '').toLowerCase());
      return false;
    }
    return true;
  });
  if (removed.length) writeJson(filePath, next);
  return { removed: removed.length, slugs: removed };
}

function purgeSlugKeyedObject(filePath, keys = ['slug']) {
  const doc = readJson(filePath, null);
  if (!doc || typeof doc !== 'object') return 0;
  let removed = 0;
  const strip = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const k of Object.keys(obj)) {
      if (isStaffPlayerSlug(k) || isStaffOrCoachName(k.replace(/-/g, ' '))) {
        delete obj[k];
        removed++;
      }
    }
  };
  if (Array.isArray(doc)) {
    const before = doc.length;
    const next = doc.filter((row) => !isPhantomPlayer(row) && !keys.some((k) => isStaffPlayerSlug(row?.[k])));
    if (next.length !== before) {
      writeJson(filePath, next);
      return before - next.length;
    }
    return 0;
  }
  if (Array.isArray(doc.targets)) {
    const before = doc.targets.length;
    doc.targets = doc.targets.filter((t) => !isPhantomPlayer(t));
    removed += before - doc.targets.length;
  }
  if (Array.isArray(doc.entries)) {
    const before = doc.entries.length;
    doc.entries = doc.entries.filter((t) => !isPhantomPlayer(t));
    removed += before - doc.entries.length;
  }
  if (doc.names && typeof doc.names === 'object') strip(doc.names);
  if (Array.isArray(doc.slugs2028)) {
    const before = doc.slugs2028.length;
    doc.slugs2028 = doc.slugs2028.filter((s) => !isStaffPlayerSlug(s));
    removed += before - doc.slugs2028.length;
  }
  strip(doc);
  if (removed) writeJson(filePath, doc);
  return removed;
}

function purgeStampFiles(stampsDir) {
  if (!fs.existsSync(stampsDir)) return 0;
  let removed = 0;
  for (const slug of staffPhantomSlugs()) {
    const p = path.join(stampsDir, `${slug}.json`);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      removed++;
    }
  }
  return removed;
}

async function purgeFuturecastDb(slugs) {
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_DATABASE_URL) {
    return { skipped: true, reason: 'no DATABASE_URL' };
  }
  try {
    const { db, closeDb } = await import('../models/db.ts');
    const pred = await db.query(
      `DELETE FROM futurecast.predictions p
       USING futurecast.players pl
       WHERE p.player_id = pl.id AND pl.slug = ANY($1::text[])`,
      [slugs]
    );
    const players = await db.query(
      `DELETE FROM futurecast.players WHERE slug = ANY($1::text[]) RETURNING slug`,
      [slugs]
    );
    await closeDb();
    return {
      predictions: pred.rowCount || 0,
      players: players.rowCount || 0,
      slugs: players.rows?.map((r) => r.slug) || [],
    };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

function removeAdminAllowlistStaff() {
  try {
    const { removeFromAdminAllowlist, loadAdminAllowlist } = require('./admin-allowlist-store');
    const before = loadAdminAllowlist();
    const hits = (before.slugs2028 || []).filter((s) => isStaffPlayerSlug(s));
    const results = [];
    for (const slug of hits) {
      results.push(removeFromAdminAllowlist({ slug, classYear: 2028 }));
    }
    return { removed: hits.length, slugs: hits, results };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

/**
 * Full purge across durable recruiting paths + FutureCast DB.
 */
async function purgeStaffPhantomRecruits({ clearHubCache = true } = {}) {
  const recruitingDir = resolveRecruitingDataDir();
  const serverData = path.join(__dirname, '..', 'data');
  const slugs = staffPhantomSlugs();
  const report = {
    ok: true,
    slugs,
    files: {},
    allowlist: null,
    futurecastDb: null,
    hubCacheCleared: false,
  };

  report.files.recruitingPlayers = purgePlayersArray(path.join(recruitingDir, 'players.json'));
  report.files.masterPlayers = purgePlayersArray(path.join(serverData, 'players.json'));
  report.files.board2028 = purgeSlugKeyedObject(path.join(recruitingDir, '2028-target-board.json'));
  report.files.adminAllowlistFile = purgeSlugKeyedObject(
    path.join(recruitingDir, 'admin-allowlist.json')
  );
  report.files.on3SlugMap = purgeSlugKeyedObject(
    path.join(recruitingDir, 'on3-allowlist-slugs-2028.json')
  );
  report.files.on3Rpm = purgeSlugKeyedObject(
    path.join(serverData, 'war-room', 'on3-rpm-allowlist.json')
  );
  report.files.earlyWatch = purgeSlugKeyedObject(
    path.join(serverData, 'futurecast', 'early-watchlist.json')
  );
  report.files.stamps = purgeStampFiles(
    path.join(path.dirname(recruitingDir), 'player-profiles', 'stamps')
  );
  // Repo-local stamps fallback
  report.files.stampsRepo = purgeStampFiles(path.join(serverData, 'player-profiles', 'stamps'));

  report.allowlist = removeAdminAllowlistStaff();
  report.futurecastDb = await purgeFuturecastDb(slugs);

  if (clearHubCache) {
    try {
      const hubCache = require('./recruiting-hub-cache');
      const keys = slugs.map((slug) => `hub:player:${slug}`);
      if (typeof hubCache.removeHubCacheKeys === 'function') {
        hubCache.removeHubCacheKeys(keys);
      } else if (typeof hubCache.clearHubCache === 'function') {
        hubCache.clearHubCache();
      }
      report.hubCacheCleared = true;
    } catch (err) {
      report.hubCacheError = err.message || String(err);
    }
  }

  try {
    const { rebuildRecruitingSnapshots } = require('./recruiting-snapshot-rebuild');
    await rebuildRecruitingSnapshots();
    report.snapshotsRebuilt = true;
  } catch (err) {
    report.snapshotsError = err.message || String(err);
  }

  // Chain alumni/roster phantom scrub (Kyle Trask, Caden Jones, …) so the
  // already-deployed purge-staff-phantoms admin route clears chase bleed too.
  try {
    const { purgeAlumniPhantomRecruits } = require('./purge-alumni-phantom-recruits');
    report.alumni = await purgeAlumniPhantomRecruits({ clearHubCache: clearHubCache });
  } catch (err) {
    report.alumniError = err.message || String(err);
  }

  return report;
}

module.exports = {
  staffPhantomSlugs,
  isPhantomPlayer,
  purgeStaffPhantomRecruits,
};

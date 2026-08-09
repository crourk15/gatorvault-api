/**
 * Purge UF alumni / current-roster / empty-ATH phantoms that were soft-created
 * onto the 2028 Priority Chase board (Urban Meyer, Kyle Trask, Dallas Wilson, …).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  BLOCKED_PLAYER_SLUGS,
  isBlockedRecruit,
  isEmptyAthPhantomShell,
  currentRosterRecruitCollision,
} = require('./recruiting-blocked-players');
const { resolveRecruitingDataDir } = require('./recruiting-data-dir');

function alumniPhantomSlugs() {
  return [...BLOCKED_PLAYER_SLUGS];
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
  if (isBlockedRecruit(row)) return true;
  if (isEmptyAthPhantomShell(row)) return true;
  if (currentRosterRecruitCollision(row)) return true;
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
      if (isBlockedRecruit({ slug: k }) || isBlockedRecruit({ name: k.replace(/-/g, ' ') })) {
        delete obj[k];
        removed += 1;
      }
    }
  };
  if (Array.isArray(doc)) {
    const before = doc.length;
    const next = doc.filter(
      (row) => !isPhantomPlayer(row) && !keys.some((k) => isBlockedRecruit({ slug: row?.[k] }))
    );
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
    doc.slugs2028 = doc.slugs2028.filter((s) => !isBlockedRecruit({ slug: s }));
    removed += before - doc.slugs2028.length;
  }
  strip(doc);
  if (removed) writeJson(filePath, doc);
  return removed;
}

function purgeStampFiles(stampsDir) {
  if (!fs.existsSync(stampsDir)) return 0;
  let removed = 0;
  for (const slug of alumniPhantomSlugs()) {
    const p = path.join(stampsDir, `${slug}.json`);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      removed += 1;
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

function removeAdminAllowlistAlumni() {
  try {
    const { removeFromAdminAllowlist, loadAdminAllowlist } = require('./admin-allowlist-store');
    const before = loadAdminAllowlist();
    const hits = (before.slugs2028 || []).filter((s) => isBlockedRecruit({ slug: s }));
    const results = [];
    for (const slug of hits) {
      results.push(removeFromAdminAllowlist({ slug, classYear: 2028 }));
    }
    return { removed: hits.length, slugs: hits, results };
  } catch (err) {
    return { error: err.message || String(err) };
  }
}

async function purgeAlumniPhantomRecruits({ clearHubCache = true, rebuildSnapshots = false } = {}) {
  const recruitingDir = resolveRecruitingDataDir();
  const serverData = path.join(__dirname, '..', 'data');
  const slugs = alumniPhantomSlugs();
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
  report.files.stampsRepo = purgeStampFiles(path.join(serverData, 'player-profiles', 'stamps'));


  report.allowlist = removeAdminAllowlistAlumni();
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
      // Drop FutureCast HP disk snapshots so alumni cards cannot resurrect.
      try {
        const diskDir = path.join(serverData, 'futurecast-cache');
        for (const year of [2028, 2027]) {
          const hp = path.join(diskDir, `high-priority-${year}.json`);
          if (fs.existsSync(hp)) fs.unlinkSync(hp);
        }
      } catch {
        /* optional */
      }
      report.hubCacheCleared = true;
    } catch (err) {
      report.hubCacheError = err.message || String(err);
    }
  }

  // Never run full page/hub snapshot rebuild during boot/admin purge on Starter —
  // that rebuild blocks the event loop long enough for Render to 502.
  if (rebuildSnapshots) {
    try {
      const { rebuildRecruitingSnapshots } = require('./recruiting-snapshot-rebuild');
      await rebuildRecruitingSnapshots();
      report.snapshotRebuilt = true;
    } catch (err) {
      report.snapshotError = err.message || String(err);
    }
  } else {
    report.snapshotRebuilt = false;
    report.snapshotSkipped = 'boot_safe_default';
  }

  return report;
}

module.exports = {
  alumniPhantomSlugs,
  isPhantomPlayer,
  purgeAlumniPhantomRecruits,
};

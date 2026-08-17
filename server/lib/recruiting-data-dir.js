const fs = require('fs');
const path = require('path');

const BUNDLE_DIR = path.join(__dirname, '..', 'data', 'recruiting');
const RENDER_DIR = '/var/data/recruiting';

function resolveRecruitingDataDir() {
  const fromEnv = String(process.env.GV_RECRUITING_DATA_DIR || '').trim();
  if (fromEnv) return fromEnv;
  try {
    if (process.env.NODE_ENV === 'production' && fs.existsSync('/var/data')) {
      return RENDER_DIR;
    }
  } catch {
    /* ignore */
  }
  return BUNDLE_DIR;
}

/**
 * Copy missing JSON artifacts from bundled recruiting data into durable dir.
 * Never overwrites non-empty durable files.
 */
function copyJsonIfMissing(src, dest) {
  if (!fs.existsSync(src) || fs.existsSync(dest)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return true;
}


/**
 * Durable /var/data players.json is never overwritten on deploy. Copy fresher
 * On3 Industry Consensus ranks from the git bundle into durable rows so profile
 * cards pick up rank syncs without waiting for a live On3 crawl.
 */
function mergeBundledIndustryRanksIfFresher(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  const durablePath = path.join(dataDir, 'players.json');
  const bundlePath = path.join(BUNDLE_DIR, 'players.json');
  if (!fs.existsSync(durablePath) || !fs.existsSync(bundlePath)) {
    return { merged: false, reason: 'missing_file' };
  }
  try {
    const durable = JSON.parse(fs.readFileSync(durablePath, 'utf8'));
    const bundled = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    if (!Array.isArray(durable) || !Array.isArray(bundled)) {
      return { merged: false, reason: 'not_array' };
    }
    const bySlug = new Map(
      bundled
        .filter((p) => p && p.slug)
        .map((p) => [String(p.slug).toLowerCase(), p])
    );
    const RANK_KEYS = ['natlRank', 'posRank', 'stateRank', 'rating', 'stars', 'displayRating'];
    let updated = 0;
    for (let i = 0; i < durable.length; i += 1) {
      const row = durable[i];
      if (!row?.slug) continue;
      const src = bySlug.get(String(row.slug).toLowerCase());
      if (!src) continue;
      const srcAt = Date.parse(String(src.rankSyncedAt || src.updatedAt || '')) || 0;
      const dstAt = Date.parse(String(row.rankSyncedAt || row.updatedAt || '')) || 0;
      const srcHasRank = src.natlRank != null && src.natlRank !== '';
      if (!srcHasRank) continue;
      const shouldCopy =
        srcAt > dstAt ||
        (row.natlRank == null || row.natlRank === '') ||
        (Number(src.natlRank) !== Number(row.natlRank) && srcAt >= dstAt && src.on3Source === 'on3-board-sync');
      if (!shouldCopy && Number(src.natlRank) === Number(row.natlRank)) continue;
      if (!shouldCopy) continue;
      let changed = false;
      for (const key of RANK_KEYS) {
        if (src[key] == null || src[key] === '') continue;
        if (row[key] !== src[key]) {
          row[key] = src[key];
          changed = true;
        }
      }
      if (src.rankSyncedAt && row.rankSyncedAt !== src.rankSyncedAt) {
        row.rankSyncedAt = src.rankSyncedAt;
        changed = true;
      }
      if (src.on3Source && !row.on3Source) row.on3Source = src.on3Source;
      if (changed) {
        durable[i] = row;
        updated += 1;
      }
    }
    if (updated > 0) {
      fs.writeFileSync(durablePath, JSON.stringify(durable, null, 2));
    }
    return { merged: updated > 0, updated };
  } catch (err) {
    console.warn('[recruiting-data-dir] industry rank merge skipped:', err.message);
    return { merged: false, error: err.message };
  }
}


/**
 * Durable /var/data players.json keeps stale On3 boards across deploys
 * (copyJsonIfMissing never overwrites). That stranded Girton as empty
 * topTeams + fake Florida 96 on the HP plate while the git bundle had
 * Penn State 38 / Florida 9. Merge board-truth fields when the bundle
 * disagrees with a sole-board Florida lock or fills missing peers.
 */
function floridaShareFromTopTeams(teams) {
  if (!Array.isArray(teams) || !teams.length) return null;
  let best = null;
  for (const t of teams) {
    const name = String(t?.team?.name || t?.team?.fullName || t?.name || '').trim();
    if (!name) continue;
    if (!/\bflorida\b|\bgators\b/i.test(name) || /florida state|south florida/i.test(name)) {
      continue;
    }
    const raw = Number(t?.prediction ?? t?.pct ?? t?.score);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const pct = raw <= 1.5 ? raw * 100 : raw;
    if (best == null || pct > best) best = pct;
  }
  return best;
}

function peerCountFromTopTeams(teams) {
  if (!Array.isArray(teams) || !teams.length) return 0;
  let n = 0;
  for (const t of teams) {
    const name = String(t?.team?.name || t?.team?.fullName || t?.name || '').trim();
    if (!name) continue;
    if (/\bflorida\b|\bgators\b/i.test(name) && !/florida state|south florida/i.test(name)) {
      continue;
    }
    const pct = Number(t?.prediction ?? t?.pct ?? t?.score);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const scaled = pct <= 1.5 ? pct * 100 : pct;
    if (scaled >= 5) n += 1;
  }
  return n;
}

function mergeBundledOn3BoardTruthIfFresher(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  const durablePath = path.join(dataDir, 'players.json');
  const bundlePath = path.join(BUNDLE_DIR, 'players.json');
  if (!fs.existsSync(durablePath) || !fs.existsSync(bundlePath)) {
    return { merged: false, reason: 'missing_file' };
  }
  try {
    const durable = JSON.parse(fs.readFileSync(durablePath, 'utf8'));
    const bundled = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    if (!Array.isArray(durable) || !Array.isArray(bundled)) {
      return { merged: false, reason: 'not_array' };
    }
    const bySlug = new Map(
      bundled.filter((p) => p && p.slug).map((p) => [String(p.slug).toLowerCase(), p])
    );
    const BOARD_KEYS = ['ufRpmPct', 'topTeams', 'on3TopTeams', 'competitors'];
    let updated = 0;
    for (let i = 0; i < durable.length; i += 1) {
      const row = durable[i];
      if (!row?.slug) continue;
      const src = bySlug.get(String(row.slug).toLowerCase());
      if (!src) continue;

      const dstTeams = row.topTeams || row.on3TopTeams || [];
      const srcTeams = src.topTeams || src.on3TopTeams || [];
      const dstPeers = peerCountFromTopTeams(dstTeams);
      const srcPeers = peerCountFromTopTeams(srcTeams);
      const dstRpm = Number(row.ufRpmPct);
      const srcRpm = Number(src.ufRpmPct);
      const srcFl = floridaShareFromTopTeams(srcTeams);
      const dstFl = floridaShareFromTopTeams(dstTeams);
      const truthRpm =
        srcFl != null && Number.isFinite(srcFl)
          ? srcFl
          : Number.isFinite(srcRpm)
            ? srcRpm
            : null;

      const missingPeers = srcPeers > 0 && dstPeers === 0;
      const poisonedLock =
        Number.isFinite(dstRpm) &&
        dstRpm >= 70 &&
        truthRpm != null &&
        truthRpm + 40 < dstRpm;
      const rivalLedBundle =
        srcPeers > 0 &&
        truthRpm != null &&
        Number.isFinite(dstRpm) &&
        dstRpm >= 70 &&
        (srcFl == null || srcFl + 15 < dstRpm);

      if (!missingPeers && !poisonedLock && !rivalLedBundle) continue;

      let changed = false;
      for (const key of BOARD_KEYS) {
        const val = src[key];
        if (val == null) continue;
        if (Array.isArray(val) && val.length === 0) continue;
        if (JSON.stringify(row[key]) !== JSON.stringify(val)) {
          row[key] = val;
          changed = true;
        }
      }
      if (changed) {
        durable[i] = row;
        updated += 1;
      }
    }
    if (updated > 0) {
      fs.writeFileSync(durablePath, JSON.stringify(durable, null, 2));
    }
    return { merged: updated > 0, updated };
  } catch (err) {
    console.warn('[recruiting-data-dir] On3 board-truth merge skipped:', err.message);
    return { merged: false, error: err.message };
  }
}

function migrateRecruitingBundleIfNeeded(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { migrated: false, reason: 'same_path' };
  }
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    if (!fs.existsSync(BUNDLE_DIR)) return { migrated: false, reason: 'no_bundle' };
    let copied = 0;
    for (const name of fs.readdirSync(BUNDLE_DIR)) {
      if (!name.endsWith('.json')) continue;
      const src = path.join(BUNDLE_DIR, name);
      const dest = path.join(dataDir, name);
      if (fs.existsSync(dest)) {
        try {
          const existing = JSON.parse(fs.readFileSync(dest, 'utf8'));
          if (Array.isArray(existing) ? existing.length > 0 : existing && Object.keys(existing).length > 0) {
            continue;
          }
        } catch {
          continue;
        }
      }
      if (copyJsonIfMissing(src, dest)) copied += 1;
    }
    // Seed Lab HP snapshots into durable disk (Starter cannot rebuild these in-process).
    const seedRuntime = path.join(BUNDLE_DIR, 'futurecast-runtime');
    const destRuntime = path.join(dataDir, 'futurecast-runtime');
    if (fs.existsSync(seedRuntime)) {
      fs.mkdirSync(destRuntime, { recursive: true });
      for (const name of fs.readdirSync(seedRuntime)) {
        if (!name.endsWith('.json')) continue;
        if (copyJsonIfMissing(path.join(seedRuntime, name), path.join(destRuntime, name))) {
          copied += 1;
        }
      }
    }
    // Prepared-meal profile dossiers (RPM overlaid live on GET).
    const seedStamps = path.join(__dirname, '..', 'data', 'player-profiles', 'stamps');
    const destStamps = path.join(path.dirname(dataDir), 'player-profiles', 'stamps');
    if (fs.existsSync(seedStamps) && path.resolve(destStamps) !== path.resolve(seedStamps)) {
      fs.mkdirSync(destStamps, { recursive: true });
      for (const name of fs.readdirSync(seedStamps)) {
        if (!name.endsWith('.json')) continue;
        if (copyJsonIfMissing(path.join(seedStamps, name), path.join(destStamps, name))) {
          copied += 1;
        }
      }
    }
    const rankMerge = mergeBundledIndustryRanksIfFresher(dataDir);
    if (rankMerge.updated) {
      console.log('[recruiting-data-dir] merged Industry ranks from bundle', rankMerge.updated);
    }
    const boardMerge = mergeBundledOn3BoardTruthIfFresher(dataDir);
    if (boardMerge.updated) {
      console.log('[recruiting-data-dir] merged On3 board truth from bundle', boardMerge.updated);
    }
    return {
      migrated: copied > 0 || !!rankMerge.updated || !!boardMerge.updated,
      copied,
      rankMerge,
      boardMerge,
      to: dataDir,
    };
  } catch (err) {
    console.warn('[recruiting-data-dir] migrate skipped:', err.message);
    return { migrated: false, error: err.message };
  }
}

module.exports = {
  BUNDLE_DIR,
  RENDER_DIR,
  resolveRecruitingDataDir,
  migrateRecruitingBundleIfNeeded,
  mergeBundledIndustryRanksIfFresher,
  mergeBundledOn3BoardTruthIfFresher,
};

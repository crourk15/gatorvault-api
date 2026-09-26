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
        try {
          require('./recruiting-visit-scrub').scrubPlayerSchoolFields(row);
        } catch {
          /* optional */
        }
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
  let scale = 'unknown';
  try {
    const { detectTopTeamsPctScale } = require('./on3-board-hydrate');
    scale = detectTopTeamsPctScale(teams);
  } catch {
    scale = teams.some((t) => Number(t?.prediction ?? t?.pct ?? 0) > 1.5) ? 'percent' : 'unknown';
  }
  let best = null;
  for (const t of teams) {
    const name = String(t?.team?.name || t?.team?.fullName || t?.name || '').trim();
    if (!name) continue;
    if (!/\bflorida\b|\bgators\b/i.test(name) || /florida state|south florida/i.test(name)) {
      continue;
    }
    const raw = Number(t?.prediction ?? t?.pct ?? t?.score);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    // Percent boards: 0.80 means 0.80%, never ×100 → 80 (Gabriel poison).
    const pct = scale === 'fraction' || (scale === 'unknown' && raw <= 1 && !teams.some((x) => Number(x?.prediction ?? x?.pct ?? 0) > 1.5))
      ? raw * 100
      : raw;
    if (best == null || pct > best) best = pct;
  }
  return best;
}

function peerCountFromTopTeams(teams) {
  if (!Array.isArray(teams) || !teams.length) return 0;
  let scale = 'unknown';
  try {
    const { detectTopTeamsPctScale } = require('./on3-board-hydrate');
    scale = detectTopTeamsPctScale(teams);
  } catch {
    scale = teams.some((t) => Number(t?.prediction ?? t?.pct ?? 0) > 1.5) ? 'percent' : 'unknown';
  }
  let n = 0;
  for (const t of teams) {
    const name = String(t?.team?.name || t?.team?.fullName || t?.name || '').trim();
    if (!name) continue;
    if (/\bflorida\b|\bgators\b/i.test(name) && !/florida state|south florida/i.test(name)) {
      continue;
    }
    const pct = Number(t?.prediction ?? t?.pct ?? t?.score);
    if (!Number.isFinite(pct) || pct <= 0) continue;
    const scaled =
      scale === 'fraction' || (scale === 'unknown' && pct <= 1 && !teams.some((x) => Number(x?.prediction ?? x?.pct ?? 0) > 1.5))
        ? pct * 100
        : pct;
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
      // Bundle ufRpmPct can itself be the Gabriel poison (0.80% → stored 80).
      // Always write board Florida share when the durable lock disagrees.
      if (
        (poisonedLock || rivalLedBundle) &&
        truthRpm != null &&
        Number.isFinite(truthRpm) &&
        truthRpm + 40 < (Number.isFinite(Number(row.ufRpmPct)) ? Number(row.ufRpmPct) : dstRpm)
      ) {
        const fixedRpm = truthRpm < 1 ? Math.max(1, Math.round(truthRpm)) : Math.round(truthRpm);
        if (Number(row.ufRpmPct) !== fixedRpm) {
          row.ufRpmPct = fixedRpm;
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

function looksFloridaCommitRow(row) {
  if (!row) return false;
  const status = String(row.status || '').toLowerCase();
  return (
    ['committed', 'commit', 'signed', 'enrolled'].includes(status) &&
    /^florida$/i.test(String(row.committedTo || row.committed_to || '').trim())
  );
}

/** Git bundle commit stamps must win over durable /var/data target shells. */
function mergeBundledVerifiedCommitsIfFresher(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  const durablePath = path.join(dataDir, 'players.json');
  if (!fs.existsSync(durablePath)) return { merged: false, reason: 'missing_file' };
  try {
    const { loadBundledVerifiedPlayers } = require('./recruiting-verified-commits');
    const bundled = loadBundledVerifiedPlayers();
    if (!bundled.size) return { merged: false, updated: 0 };
    const durable = JSON.parse(fs.readFileSync(durablePath, 'utf8'));
    if (!Array.isArray(durable)) return { merged: false, reason: 'not_array' };
    let updated = 0;
    for (let i = 0; i < durable.length; i += 1) {
      const row = durable[i];
      const slug = String(row?.slug || '').toLowerCase();
      const src = bundled.get(slug);
      if (!src || !looksFloridaCommitRow(src)) continue;
      if (looksFloridaCommitRow(row) && row.commitDate === src.commitDate) continue;
      durable[i] = {
        ...row,
        status: 'committed',
        committedTo: 'Florida',
        category: 'recruit',
        commitDate: src.commitDate || row.commitDate || null,
        skinny: src.skinny || row.skinny,
        profileNote: src.profileNote || row.profileNote,
        protected: true,
        verifiedCommit: true,
      };
      updated += 1;
    }
    if (updated > 0) {
      fs.writeFileSync(durablePath, JSON.stringify(durable, null, 2));
    }
    return { merged: updated > 0, updated };
  } catch (err) {
    console.warn('[recruiting-data-dir] verified commit merge skipped:', err.message);
    return { merged: false, error: err.message };
  }
}

function commitItemsFromDoc(doc) {
  if (!doc) return [];
  if (Array.isArray(doc.items)) return doc.items;
  if (Array.isArray(doc.commits)) return doc.commits;
  return [];
}

function commitSlugsFromItems(items) {
  return new Set(
    (items || []).map((row) => String(row?.id || row?.slug || '').toLowerCase()).filter(Boolean)
  );
}

function missingVerifiedCommitSlugs(items, year) {
  let required = null;
  try {
    required = require('./recruiting-verified-commits').VERIFIED_UF_COMMITS_BY_YEAR[Number(year)];
  } catch {
    required = null;
  }
  if (!required || !required.size) return [];
  const have = commitSlugsFromItems(items);
  return [...required].filter((slug) => !have.has(slug));
}

/**
 * Durable hub-runtime commits/bundle can stay Armani-only (copyJsonIfMissing
 * never overwrites). Git bundle with the new verified commit must win.
 */
function mergeBundledHubRuntimeCommitsIfRicher(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  const years = [2027, 2028, 2029];
  let updated = 0;
  const details = [];
  for (const year of years) {
    const bundleFile = path.join(BUNDLE_DIR, 'hub-runtime', String(year), 'commits.json');
    const durableFile = path.join(dataDir, 'hub-runtime', String(year), 'commits.json');
    if (!fs.existsSync(bundleFile)) continue;
    let bundledDoc;
    try {
      bundledDoc = JSON.parse(fs.readFileSync(bundleFile, 'utf8'));
    } catch {
      continue;
    }
    const bundledItems = commitItemsFromDoc(bundledDoc);
    if (!bundledItems.length) continue;
    let durableItems = [];
    if (fs.existsSync(durableFile)) {
      try {
        durableItems = commitItemsFromDoc(JSON.parse(fs.readFileSync(durableFile, 'utf8')));
      } catch {
        durableItems = [];
      }
    }
    const missing = missingVerifiedCommitSlugs(durableItems, year);
    if (!missing.length) continue;
    const bundleHasMissing = missing.some((slug) => commitSlugsFromItems(bundledItems).has(slug));
    if (!bundleHasMissing) continue;
    try {
      fs.mkdirSync(path.dirname(durableFile), { recursive: true });
      fs.writeFileSync(durableFile, JSON.stringify(bundledDoc));
    } catch (err) {
      console.warn('[recruiting-data-dir] hub-runtime commits merge failed', year, err.message);
      continue;
    }

    const durableBundlePath = path.join(dataDir, 'hub-runtime', String(year), 'bundle.json');
    const bundledBundlePath = path.join(BUNDLE_DIR, 'hub-runtime', String(year), 'bundle.json');
    if (fs.existsSync(durableBundlePath) && fs.existsSync(bundledBundlePath)) {
      try {
        const durableBundle = JSON.parse(fs.readFileSync(durableBundlePath, 'utf8'));
        const bundledBundle = JSON.parse(fs.readFileSync(bundledBundlePath, 'utf8'));
        if (
          Array.isArray(bundledBundle.commits) &&
          missingVerifiedCommitSlugs(durableBundle.commits, year).length
        ) {
          durableBundle.commits = bundledBundle.commits;
          if (durableBundle.classOverview && bundledBundle.classOverview) {
            durableBundle.classOverview.commits = bundledBundle.classOverview.commits;
          }
          fs.writeFileSync(durableBundlePath, JSON.stringify(durableBundle));
        }
      } catch (err) {
        console.warn('[recruiting-data-dir] hub-runtime bundle nest merge failed', year, err.message);
      }
    }

    const durableOv = path.join(dataDir, 'hub-runtime', String(year), 'class-overview.json');
    const bundledOv = path.join(BUNDLE_DIR, 'hub-runtime', String(year), 'class-overview.json');
    if (fs.existsSync(bundledOv)) {
      try {
        const bOv = JSON.parse(fs.readFileSync(bundledOv, 'utf8'));
        let dCount = 0;
        if (fs.existsSync(durableOv)) {
          const dOv = JSON.parse(fs.readFileSync(durableOv, 'utf8'));
          dCount = Number.parseInt(String(dOv.commits ?? ''), 10) || 0;
        }
        const bCount = Number.parseInt(String(bOv.commits ?? ''), 10) || 0;
        if (bCount > dCount) {
          fs.mkdirSync(path.dirname(durableOv), { recursive: true });
          fs.writeFileSync(durableOv, JSON.stringify(bOv));
        }
      } catch (err) {
        console.warn('[recruiting-data-dir] hub-runtime class-overview merge failed', year, err.message);
      }
    }

    updated += 1;
    details.push({ year, missing });
  }
  return { merged: updated > 0, updated, details };
}

function overviewCommitCount(doc) {
  return Number.parseInt(String(doc?.commits ?? ''), 10) || 0;
}

function pickRicherOverview(durable, bundled) {
  if (!bundled || typeof bundled !== 'object') return durable;
  if (!durable || typeof durable !== 'object') return bundled;
  return overviewCommitCount(bundled) > overviewCommitCount(durable) ? bundled : durable;
}

function patchOverviewAllNest(doc, year, bundledNest) {
  if (!doc || typeof doc !== 'object' || !bundledNest) return false;
  const all = doc.classOverviewAll;
  if (!all || typeof all !== 'object') return false;
  const key = all[year] != null ? year : String(year);
  if (all[key] == null) return false;
  const next = pickRicherOverview(all[key], bundledNest);
  if (next === all[key]) return false;
  all[key] = next;
  return true;
}

/**
 * Hero + classOverviewAll can stay at 1 commit after commits.json already
 * has Cyion (copyJsonIfMissing never overwrites). Merge those plates even
 * when the commit list itself is complete.
 */
function mergeBundledHubRuntimeOverviewIfRicher(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  let updated = 0;
  const details = [];
  const years = [2026, 2027, 2028, 2029];

  const bundledAllPath = path.join(BUNDLE_DIR, 'hub-runtime', 'class-overview-all.json');
  const durableAllPath = path.join(dataDir, 'hub-runtime', 'class-overview-all.json');
  let bundledAll = null;
  if (fs.existsSync(bundledAllPath)) {
    try {
      bundledAll = JSON.parse(fs.readFileSync(bundledAllPath, 'utf8'));
    } catch {
      bundledAll = null;
    }
  }
  if (bundledAll && typeof bundledAll === 'object') {
    try {
      let durableAll = {};
      if (fs.existsSync(durableAllPath)) {
        durableAll = JSON.parse(fs.readFileSync(durableAllPath, 'utf8'));
      }
      let changed = false;
      for (const year of years) {
        const bNest = bundledAll[year] || bundledAll[String(year)];
        if (!bNest) continue;
        const dKey = durableAll[year] != null ? year : String(year);
        const next = pickRicherOverview(durableAll[dKey], bNest);
        if (next !== durableAll[dKey]) {
          durableAll[dKey] = next;
          changed = true;
        }
      }
      if (changed) {
        fs.mkdirSync(path.dirname(durableAllPath), { recursive: true });
        fs.writeFileSync(durableAllPath, JSON.stringify(durableAll, null, 2));
        updated += 1;
        details.push({ file: 'class-overview-all.json' });
      }
    } catch (err) {
      console.warn('[recruiting-data-dir] class-overview-all merge failed', err.message);
    }
  }

  for (const year of years) {
    const bundledOv = path.join(BUNDLE_DIR, 'hub-runtime', String(year), 'class-overview.json');
    const durableOv = path.join(dataDir, 'hub-runtime', String(year), 'class-overview.json');
    if (fs.existsSync(bundledOv)) {
      try {
        const bOv = JSON.parse(fs.readFileSync(bundledOv, 'utf8'));
        let dCount = 0;
        if (fs.existsSync(durableOv)) {
          dCount = overviewCommitCount(JSON.parse(fs.readFileSync(durableOv, 'utf8')));
        }
        if (overviewCommitCount(bOv) > dCount) {
          fs.mkdirSync(path.dirname(durableOv), { recursive: true });
          fs.writeFileSync(durableOv, JSON.stringify(bOv));
          updated += 1;
          details.push({ year, file: 'class-overview.json' });
        }
      } catch (err) {
        console.warn('[recruiting-data-dir] class-overview merge failed', year, err.message);
      }
    }

    const bundledNest =
      (bundledAll && (bundledAll[year] || bundledAll[String(year)])) ||
      null;
    const bundledHeroPath = path.join(BUNDLE_DIR, 'hub-runtime', String(year), 'hero.json');
    const durableHeroPath = path.join(dataDir, 'hub-runtime', String(year), 'hero.json');
    if (fs.existsSync(bundledHeroPath) && fs.existsSync(durableHeroPath)) {
      try {
        const bundledHero = JSON.parse(fs.readFileSync(bundledHeroPath, 'utf8'));
        const durableHero = JSON.parse(fs.readFileSync(durableHeroPath, 'utf8'));
        let changed = false;
        if (Number(bundledHero.year) === year || Number(durableHero.year) === year) {
          const nextOv = pickRicherOverview(durableHero.classOverview, bundledHero.classOverview);
          if (nextOv !== durableHero.classOverview) {
            durableHero.classOverview = nextOv;
            changed = true;
          }
          if (Array.isArray(bundledHero.ticker) && overviewCommitCount(nextOv) > 0) {
            const n = String(nextOv.commits);
            durableHero.ticker = (durableHero.ticker || bundledHero.ticker).map((line) =>
              typeof line === 'string'
                ? line.replace(/\d+ commits locked for \d+/, `${n} commits locked for ${year}`)
                : line
            );
          }
        }
        if (patchOverviewAllNest(durableHero, 2028, bundledHero.classOverviewAll?.[2028] || bundledHero.classOverviewAll?.['2028'] || bundledNest)) {
          changed = true;
        }
        if (changed) {
          fs.writeFileSync(durableHeroPath, JSON.stringify(durableHero, null, 2));
          updated += 1;
          details.push({ year, file: 'hero.json' });
        }
      } catch (err) {
        console.warn('[recruiting-data-dir] hero overview merge failed', year, err.message);
      }
    }

    const durableBundlePath = path.join(dataDir, 'hub-runtime', String(year), 'bundle.json');
    const bundledBundlePath = path.join(BUNDLE_DIR, 'hub-runtime', String(year), 'bundle.json');
    if (fs.existsSync(durableBundlePath) && fs.existsSync(bundledBundlePath)) {
      try {
        const durableBundle = JSON.parse(fs.readFileSync(durableBundlePath, 'utf8'));
        const bundledBundle = JSON.parse(fs.readFileSync(bundledBundlePath, 'utf8'));
        let changed = false;
        if (Number(year) === Number(durableBundle.year) || Number(year) === Number(bundledBundle.year)) {
          const nextOv = pickRicherOverview(durableBundle.classOverview, bundledBundle.classOverview);
          if (nextOv !== durableBundle.classOverview) {
            durableBundle.classOverview = nextOv;
            changed = true;
          }
        }
        const nest =
          bundledBundle.classOverviewAll?.[2028] ||
          bundledBundle.classOverviewAll?.['2028'] ||
          bundledNest;
        if (patchOverviewAllNest(durableBundle, 2028, nest)) changed = true;
        if (changed) {
          fs.writeFileSync(durableBundlePath, JSON.stringify(durableBundle));
          updated += 1;
          details.push({ year, file: 'bundle.json' });
        }
      } catch (err) {
        console.warn('[recruiting-data-dir] bundle overview merge failed', year, err.message);
      }
    }
  }

  return { merged: updated > 0, updated, details };
}

/** Drop verified UF commits from durable FutureCast HP so Chase cannot keep them. */
function stripVerifiedCommitsFromDurableHp(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  let isVerified = () => false;
  try {
    isVerified = require('./recruiting-verified-commits').isVerifiedUfCommitAnyYear;
  } catch {
    return { merged: false, reason: 'no_verified' };
  }
  const runtime = path.join(dataDir, 'futurecast-runtime');
  if (!fs.existsSync(runtime)) return { merged: false, reason: 'missing' };
  let updated = 0;
  const removed = [];
  for (const name of fs.readdirSync(runtime)) {
    if (!/^high-priority-\d+\.json$/.test(name)) continue;
    const filePath = path.join(runtime, name);
    try {
      const doc = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!Array.isArray(doc.players)) continue;
      const next = doc.players.filter((row) => {
        const slug = String(row?.slug || row?.id || '').toLowerCase();
        return !slug || !isVerified(slug);
      });
      if (next.length === doc.players.length) continue;
      removed.push({ file: name, dropped: doc.players.length - next.length });
      doc.players = next;
      doc.count = next.length;
      doc.updatedAt = new Date().toISOString();
      fs.writeFileSync(filePath, JSON.stringify(doc));
      updated += 1;
    } catch (err) {
      console.warn('[recruiting-data-dir] HP commit strip failed', name, err.message);
    }
  }
  return { merged: updated > 0, updated, removed };
}

function mergeBundledCommitIntelIfMissing(dataDir = resolveRecruitingDataDir()) {
  if (path.resolve(dataDir) === path.resolve(BUNDLE_DIR)) {
    return { merged: false, reason: 'same_path' };
  }
  const durablePath = path.join(dataDir, 'intel.json');
  const bundlePath = path.join(BUNDLE_DIR, 'intel.json');
  if (!fs.existsSync(durablePath) || !fs.existsSync(bundlePath)) {
    return { merged: false, reason: 'missing_file' };
  }
  try {
    const { isVerifiedUfCommitAnyYear } = require('./recruiting-verified-commits');
    const durable = JSON.parse(fs.readFileSync(durablePath, 'utf8'));
    const bundled = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    const items = Array.isArray(durable.items) ? durable.items : [];
    const seen = new Set(items.map((i) => i && i.fingerprint).filter(Boolean));
    let updated = 0;
    for (const row of bundled.items || []) {
      if (!row || String(row.eventType || '') !== 'commit') continue;
      const slug = String(row.playerSlug || '').toLowerCase();
      if (!isVerifiedUfCommitAnyYear(slug)) continue;
      if (!row.fingerprint || seen.has(row.fingerprint)) continue;
      items.unshift(row);
      seen.add(row.fingerprint);
      updated += 1;
    }
    if (updated > 0) {
      durable.items = items;
      durable.updatedAt = new Date().toISOString();
      fs.writeFileSync(durablePath, JSON.stringify(durable, null, 2));
    }
    return { merged: updated > 0, updated };
  } catch (err) {
    console.warn('[recruiting-data-dir] commit intel merge skipped:', err.message);
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
    const commitMerge = mergeBundledVerifiedCommitsIfFresher(dataDir);
    if (commitMerge.updated) {
      console.log('[recruiting-data-dir] merged verified UF commits from bundle', commitMerge.updated);
    }
    const intelMerge = mergeBundledCommitIntelIfMissing(dataDir);
    if (intelMerge.updated) {
      console.log('[recruiting-data-dir] merged commit intel from bundle', intelMerge.updated);
    }
    const hubRuntimeMerge = mergeBundledHubRuntimeCommitsIfRicher(dataDir);
    if (hubRuntimeMerge.updated) {
      console.log('[recruiting-data-dir] merged hub-runtime commits from bundle', hubRuntimeMerge.details);
    }
    const hubOverviewMerge = mergeBundledHubRuntimeOverviewIfRicher(dataDir);
    if (hubOverviewMerge.updated) {
      console.log('[recruiting-data-dir] merged hub-runtime overview from bundle', hubOverviewMerge.details);
    }
    const hpStrip = stripVerifiedCommitsFromDurableHp(dataDir);
    if (hpStrip.updated) {
      console.log('[recruiting-data-dir] stripped verified UF commits from durable HP', hpStrip.removed);
    }
    // Denied visit stones (e.g. Tranard Auburn UV) must not survive on durable disk.
    let visitScrub = { healed: false };
    try {
      visitScrub = require('./recruiting-visit-scrub').healDurableDeniedVisits(
        path.join(dataDir, 'players.json')
      );
      if (visitScrub.healed) {
        console.log('[recruiting-data-dir] scrubbed denied visits from durable players', visitScrub.changed);
      }
    } catch (err) {
      console.warn(
        '[recruiting-data-dir] denied-visit scrub failed:',
        err && err.message ? err.message : err
      );
    }
    // Defer board-truth merge — sync parse/stringify of players.json (~9MB) during
    // recruiting-store require can spike memory right as Render health-checks /ready
    // and contribute to exit-143 restart loops after deploy.
    setTimeout(() => {
      try {
        // Per-row scrub inside mergeBundledOn3BoardTruthIfFresher — do NOT
        // rewrite all of players.json here (sync parse/stringify starves /ready → 502).
        const boardMerge = mergeBundledOn3BoardTruthIfFresher(dataDir);
        if (boardMerge.updated) {
          console.log('[recruiting-data-dir] merged On3 board truth from bundle', boardMerge.updated);
        }
      } catch (err) {
        console.warn(
          '[recruiting-data-dir] deferred On3 board-truth merge failed:',
          err && err.message ? err.message : err
        );
      }
    }, 45_000);
    return {
      migrated:
        copied > 0 ||
        !!rankMerge.updated ||
        !!visitScrub.healed ||
        !!hubRuntimeMerge.updated ||
        !!hpStrip.updated,
      copied,
      rankMerge,
      visitScrub,
      hubRuntimeMerge,
      hpStrip,
      boardMerge: { merged: false, deferred: true },
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
  mergeBundledVerifiedCommitsIfFresher,
  mergeBundledCommitIntelIfMissing,
  mergeBundledHubRuntimeCommitsIfRicher,
  mergeBundledHubRuntimeOverviewIfRicher,
  stripVerifiedCommitsFromDurableHp,
};

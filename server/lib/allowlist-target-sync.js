/**
 * Sync allow-list target profiles from On3/Rivals into recruiting store (DB or JSON).
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const on3Recruit = require('./on3-recruit-client');
const { rebuildPlayerIdentityFromOn3, validatePlayerIdentityRecord, applyCanonicalFixup } = require('./identity-record-validator');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  CANONICAL_TARGET_NAMES,
  canonicalTargetSlug,
} = require('./recruiting-target-allowlist');
const { applyEditorialPositionToPlayer } = require('./recruiting-editorial-positions');
const { isPlaceholderSchool } = require('./recruiting-placeholder-school');
const { discoverOn3RecruitSlug, profileToSchoolPatch } = require('./on3-recruit-discovery');
const { persistAllowlistPlayerToJson, applyAllowlistIntelSkinny } = require('./allowlist-school-persist');
const { isFloridaSchool, isActiveUfTarget, isCommittedElsewhere } = require('./recruiting-target-filters');
const monitoring = require('./recruiting-monitoring');

const DELAY_MS = Math.max(250, parseInt(process.env.ON3_INGEST_DELAY_MS || '450', 10) || 450);
const RIVALS_PREDICTIONS_PATH = path.join(__dirname, '..', 'data', 'war-room', 'rivals-predictions.json');
const STATE_PATH = path.join(store.DATA_DIR, 'commitment-sync-state.json');
const ON3_INGEST_LOG = path.join(store.DATA_DIR, 'on3-ingest-log.json');
const ON3_SNAPSHOT = path.join(store.DATA_DIR, 'on3-snapshot.json');
const STALE_HOURS = parseInt(process.env.COMMITMENT_SYNC_STALE_HOURS || '36', 10);

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

function hoursSince(iso) {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

function teamNameFromOn3(team) {
  return team?.fullName || team?.name || team?.abbreviation || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function allowlistJobs() {
  const { loadAdminAllowlist } = require('./admin-allowlist-store');
  const admin = loadAdminAllowlist();
  const jobs = [
    ...ALLOWLIST_2027.map((slug) => ({ slug, classYear: 2027 })),
    ...ALLOWLIST_2028.map((slug) => ({ slug, classYear: 2028 })),
  ];
  for (const slug of admin.slugs2027 || []) {
    if (!jobs.some((job) => job.slug === slug && job.classYear === 2027)) {
      jobs.push({ slug, classYear: 2027 });
    }
  }
  for (const slug of admin.slugs2028 || []) {
    if (!jobs.some((job) => job.slug === slug && job.classYear === 2028)) {
      jobs.push({ slug, classYear: 2028 });
    }
  }
  return jobs;
}

function profilePatchFromOn3(profile, classYear) {
  const commit = on3Recruit.getCollegeCommit(profile.topTeams, classYear);
  const committedTo = commit ? teamNameFromOn3(commit.team) : null;
  const ufCommitted = commit && on3Recruit.isFloridaTeam(commit);

  const patch = {
    name: profile.name,
    pos: profile.pos || null,
    classYear: profile.classYear || classYear,
    committedTo: ufCommitted ? 'Florida' : committedTo,
    status: committedTo ? 'committed' : 'uncommitted',
    category: committedTo ? 'recruit' : 'target',
    commitDate: commit?.committedDate || null,
    on3Source: 'on3-allowlist-sync',
  };

  if (profile.school) patch.school = profile.school;
  if (profile.state) patch.state = profile.state;
  if (profile.rating != null && Number.isFinite(Number(profile.rating))) {
    patch.rating = Number(profile.rating);
    patch.stars = profile.stars ?? patch.stars ?? null;
    patch.natlRank = profile.natlRank ?? null;
    patch.posRank = profile.posRank ?? null;
    patch.stateRank = profile.stateRank ?? null;
    patch.on3Source = 'on3-board-sync';
  }

  return patch;
}

function localJsonPlayer(slug) {
  try {
    return store.findBySlug(slug);
  } catch {
    return null;
  }
}

function mergeAllowlistPlayerPatch(existing, localPlayer, profilePatch, slug, classYear, playerName) {
  const committedTo = profilePatch.committedTo ?? existing?.committedTo ?? localPlayer?.committedTo ?? null;
  const ufCommitted = committedTo && isFloridaSchool(committedTo);
  let merged = applyEditorialPositionToPlayer({
    ...localPlayer,
    ...existing,
    ...profilePatch,
    slug,
    classYear,
    name: profilePatch.name || existing?.name || localPlayer?.name || playerName,
    pos: profilePatch.pos || existing?.pos || localPlayer?.pos,
    committedTo: ufCommitted ? 'Florida' : committedTo,
    status: committedTo ? 'committed' : 'uncommitted',
    category: committedTo ? 'recruit' : 'target',
    commitDate: profilePatch.commitDate ?? existing?.commitDate ?? localPlayer?.commitDate ?? null,
    commitmentSyncAt: new Date().toISOString(),
    commitmentSource: profilePatch.committedTo ? 'on3-allowlist-sync' : existing?.commitmentSource || null,
    on3Source: profilePatch.on3Source || 'on3-allowlist-sync',
    updatedAt: new Date().toISOString(),
  });

  if (
    isPlaceholderSchool(merged.school) &&
    localPlayer?.school &&
    !isPlaceholderSchool(localPlayer.school)
  ) {
    merged.school = localPlayer.school;
  }
  if (
    isPlaceholderSchool(merged.school) &&
    existing?.school &&
    !isPlaceholderSchool(existing.school)
  ) {
    merged.school = existing.school;
  }
  return applyCanonicalFixup(slug, merged);
}

async function buildProfilePatchFromDiscovery(slug, classYear, existing, playerName) {
  const discovery = await discoverOn3RecruitSlug(slug, {
    classYear,
    player: existing,
    name: playerName,
    pos: existing?.pos || null,
  });

  if (discovery.profile && !discovery.profile.error) {
    const profilePatch = profilePatchFromOn3(discovery.profile, classYear);
    const schoolPatch = profileToSchoolPatch(discovery.profile);
    return {
      profilePatch: { ...profilePatch, ...schoolPatch },
      source: discovery.source,
    };
  }

  if (discovery.recruitSlug) {
    try {
      const profile = await on3Recruit.fetchRecruitProfile(discovery.recruitSlug, classYear);
      if (profile && !profile.error) {
        const profilePatch = profilePatchFromOn3(profile, classYear);
        return {
          profilePatch: { ...profilePatch, ...profileToSchoolPatch(profile) },
          source: discovery.source || 'stored_slug',
        };
      }
    } catch {
      /* optional */
    }
  }

  return { profilePatch: {}, source: discovery.source || null };
}

async function syncSlugFromOn3Fast(slug, classYear) {
  const existing = await store.getPlayerBySlug(slug);
  const localPlayer = localJsonPlayer(slug);
  const playerName = CANONICAL_TARGET_NAMES[slug] || existing?.name || localPlayer?.name || slug;
  const { profilePatch } = await buildProfilePatchFromDiscovery(slug, classYear, existing, playerName);

  if (!profilePatch.school && localPlayer?.school && !isPlaceholderSchool(localPlayer.school)) {
    profilePatch.school = localPlayer.school;
  }
  if (!profilePatch.state && (localPlayer?.state || existing?.state)) {
    profilePatch.state = localPlayer?.state || existing?.state;
  }
  for (const field of ['natlRank', 'posRank', 'stateRank', 'rating', 'stars']) {
    if (profilePatch[field] == null && localPlayer?.[field] != null) {
      profilePatch[field] = localPlayer[field];
    }
  }

  const merged = applyAllowlistIntelSkinny(
    mergeAllowlistPlayerPatch(existing, localPlayer, profilePatch, slug, classYear, playerName)
  );
  const validation = validatePlayerIdentityRecord(merged);
  if (!validation.valid || isPlaceholderSchool(merged.school)) {
    return null;
  }

  await store.upsertPlayer(merged);
  if (merged.school && !isPlaceholderSchool(merged.school)) {
    persistAllowlistPlayerToJson(slug, {
      name: merged.name,
      pos: merged.pos,
      classYear: merged.classYear,
      school: merged.school,
      state: merged.state ?? merged.hometownState ?? null,
      inState: merged.inState,
      rating: merged.rating,
      natlRank: merged.natlRank,
      posRank: merged.posRank,
      stateRank: merged.stateRank,
      stars: merged.stars,
      on3Source: merged.on3Source,
      on3Slug: merged.on3Slug,
      on3Id: merged.on3Id,
    });
  }

  const committedTo = merged.committedTo || null;
  return {
    slug,
    classYear,
    ok: true,
    fast: true,
    committedTo,
    pos: merged.pos || null,
    ranked: merged.on3Source === 'on3-board-sync',
  };
}

async function syncSlugFromOn3(slug, classYear) {
  const fastPathEnabled = process.env.ALLOWLIST_SYNC_FAST_PATH !== 'false';
  if (fastPathEnabled) {
    try {
      const fast = await syncSlugFromOn3Fast(slug, classYear);
      if (fast?.ok) return fast;
    } catch {
      /* fall back to full identity rebuild */
    }
  }

  const existing = await store.getPlayerBySlug(slug);
  const playerName = CANONICAL_TARGET_NAMES[slug] || existing?.name || slug;

  const identity = await rebuildPlayerIdentityFromOn3(slug, { classYear });
  if (identity.ok && identity.player) {
    const p = identity.player;
    let profilePatch = {};
    const discovery = await discoverOn3RecruitSlug(slug, {
      classYear,
      player: existing,
      name: playerName,
      pos: p.pos || existing?.pos || null,
    });
    if (discovery.profile && !discovery.profile.error) {
      profilePatch = profilePatchFromOn3(discovery.profile, classYear);
      const schoolPatch = profileToSchoolPatch(discovery.profile);
      if (schoolPatch.school) profilePatch.school = schoolPatch.school;
      if (schoolPatch.state) profilePatch.state = schoolPatch.state;
      if (schoolPatch.inState != null) profilePatch.inState = schoolPatch.inState;
      if (schoolPatch.on3Slug) profilePatch.on3Slug = schoolPatch.on3Slug;
      if (schoolPatch.on3Id) profilePatch.on3Id = schoolPatch.on3Id;
    } else {
      try {
        const recruitSlug =
          p.on3Slug ||
          `${store.slugify(p.name || playerName)}${p.on3Id && /^\d+$/.test(String(p.on3Id)) ? `-${p.on3Id}` : ''}`;
        const profile = await on3Recruit.fetchRecruitProfile(recruitSlug, classYear);
        if (profile && !profile.error) {
          profilePatch = profilePatchFromOn3(profile, classYear);
        }
      } catch {
        /* profile optional */
      }
    }

    if (!profilePatch.school && p.school && !isPlaceholderSchool(p.school)) {
      profilePatch.school = p.school;
    }
    if (!profilePatch.state && p.state) profilePatch.state = p.state;

    const committedTo = profilePatch.committedTo ?? p.committedTo ?? existing?.committedTo ?? null;
    const ufCommitted = committedTo && isFloridaSchool(committedTo);

    let merged = applyAllowlistIntelSkinny(
      applyEditorialPositionToPlayer({
        ...existing,
        ...p,
        ...profilePatch,
        slug,
        classYear,
        name: p.name || profilePatch.name || playerName,
        pos: profilePatch.pos || p.pos || existing?.pos,
        committedTo: ufCommitted ? 'Florida' : committedTo,
        status: committedTo ? 'committed' : 'uncommitted',
        category: committedTo ? 'recruit' : 'target',
        commitDate: profilePatch.commitDate ?? p.commitDate ?? existing?.commitDate ?? null,
        commitmentSyncAt: new Date().toISOString(),
        commitmentSource: profilePatch.committedTo ? 'on3-allowlist-sync' : existing?.commitmentSource || null,
        on3Source: profilePatch.on3Source || 'on3-allowlist-sync',
        updatedAt: new Date().toISOString(),
      })
    );

    if (
      isPlaceholderSchool(merged.school) &&
      existing?.school &&
      !isPlaceholderSchool(existing.school)
    ) {
      merged.school = existing.school;
    }

    merged = applyCanonicalFixup(slug, merged);

    await store.upsertPlayer(merged);

    if (merged.school && !isPlaceholderSchool(merged.school)) {
      persistAllowlistPlayerToJson(slug, {
        name: merged.name,
        pos: merged.pos,
        classYear: merged.classYear,
        school: merged.school,
        state: merged.state ?? merged.hometownState ?? null,
        inState: merged.inState,
        rating: merged.rating,
        natlRank: merged.natlRank,
        posRank: merged.posRank,
        stateRank: merged.stateRank,
        stars: merged.stars,
        on3Source: merged.on3Source,
        on3Slug: merged.on3Slug,
        on3Id: merged.on3Id,
      });
    }

    return {
      slug,
      classYear,
      ok: true,
      committedTo: committedTo || null,
      pos: profilePatch.pos || p.pos || null,
      ranked: profilePatch.on3Source === 'on3-board-sync',
    };
  }

  return { slug, classYear, ok: false, error: identity.error || 'identity_failed' };
}

async function syncAllowlistTargetsFromOn3(options = {}) {
  const limit = options.limit || parseInt(process.env.ALLOWLIST_SYNC_LIMIT || '0', 10) || 0;
  let jobs = allowlistJobs();
  if (options.classYear) {
    jobs = jobs.filter((job) => job.classYear === Number(options.classYear));
  }
  const results = { updated: 0, ranked: 0, committedElsewhere: 0, skipped: 0, failed: [], fast: 0 };

  for (let i = 0; i < jobs.length; i += 1) {
    if (limit > 0 && i >= limit) break;
    const { slug, classYear } = jobs[i];
    let row = null;
    try {
      row = await syncSlugFromOn3(slug, classYear);
      if (row.ok) {
        results.updated += 1;
        if (row.fast) results.fast += 1;
        if (row.ranked) results.ranked += 1;
        if (row.committedTo && !isFloridaSchool(row.committedTo)) {
          results.committedElsewhere += 1;
        }
      } else {
        results.failed.push(row);
      }
    } catch (err) {
      results.failed.push({ slug, classYear, ok: false, error: err.message });
    }
    if (i < jobs.length - 1) {
      const delay = row?.fast ? Math.min(DELAY_MS, 150) : DELAY_MS;
      await sleep(delay);
    }
  }

  console.log('[allowlist-sync] On3 complete', results);
  clearRankingIndexCache();
  return results;
}

function clearRankingIndexCache() {
  try {
    require('tsx/cjs');
    const { clearRecruitingRankingsCache } = require('../lib/load-recruiting-rankings.ts');
    clearRecruitingRankingsCache();
  } catch {
    /* optional */
  }
}

function loadRivalsCommittedBySlug() {
  const fs = require('fs');
  const bySlug = new Map();
  try {
    const doc = JSON.parse(fs.readFileSync(RIVALS_PREDICTIONS_PATH, 'utf8'));
    for (const row of doc.predictions || []) {
      const slug = String(row.playerSlug || '').toLowerCase();
      if (!slug) continue;
      if (row.isCommitted && row.committedTo) {
        bySlug.set(slug, {
          committedTo: row.committedTo,
          pos: row.pos || null,
        });
      }
    }
  } catch {
    /* optional */
  }
  return bySlug;
}

/** Refresh position/commit status for allow-list slugs from Rivals predictions cache. */
async function syncAllowlistTargetsFromRivals() {
  const rivalsBySlug = loadRivalsCommittedBySlug();
  const results = { updated: 0, committedElsewhere: 0 };

  for (const { slug, classYear } of allowlistJobs()) {
    const rivals = rivalsBySlug.get(slug);
    if (!rivals?.committedTo) continue;

    const existing = await store.getPlayerBySlug(slug);
    if (!existing && !CANONICAL_TARGET_NAMES[slug]) continue;

    const committedTo = rivals.committedTo;
    const ufCommitted = isFloridaSchool(committedTo);

    await store.upsertPlayer({
      ...(existing || {}),
      slug,
      name: existing?.name || CANONICAL_TARGET_NAMES[slug],
      classYear: existing?.classYear || classYear,
      pos: rivals.pos || existing?.pos,
      committedTo: ufCommitted ? 'Florida' : committedTo,
      status: 'committed',
      category: committedTo ? 'recruit' : 'target',
      commitmentSyncAt: new Date().toISOString(),
      commitmentSource: 'rivals-allowlist-sync',
      rivalsSource: 'rivals-allowlist-sync',
      updatedAt: new Date().toISOString(),
    });

    results.updated += 1;
    if (!ufCommitted) results.committedElsewhere += 1;
  }

  console.log('[allowlist-sync] Rivals complete', results);
  return results;
}

async function syncLiveRivalsCommits() {
  const results = { updated: 0, committedElsewhere: 0, errors: [] };
  try {
    const client = require('./rivals-prediction-client');
    const rows = await client.fetchAllUfPredictions([2027, 2028, 2029]);
    for (const row of rows) {
      if (!row.isCommitted || !row.committedTo) continue;
      const slug = canonicalTargetSlug(row.playerSlug);
      if (!allowlistJobs().some((j) => j.slug === slug)) continue;
      const existing = await store.getPlayerBySlug(slug);
      if (!existing && !CANONICAL_TARGET_NAMES[slug]) continue;
      const committedTo = row.committedTo;
      const ufCommitted = isFloridaSchool(committedTo);
      await store.upsertPlayer({
        ...(existing || {}),
        slug,
        name: existing?.name || row.playerName || CANONICAL_TARGET_NAMES[slug],
        classYear: existing?.classYear || row.classYear,
        pos: row.pos || existing?.pos,
        committedTo: ufCommitted ? 'Florida' : committedTo,
        status: 'committed',
        category: 'recruit',
        commitmentSyncAt: new Date().toISOString(),
        commitmentSource: 'rivals_pm_live',
        updatedAt: new Date().toISOString(),
      });
      results.updated += 1;
      if (!ufCommitted) results.committedElsewhere += 1;
    }
  } catch (e) {
    results.errors.push(e.message);
  }
  return results;
}

async function refreshHubAfterCommitmentChanges(changedCount) {
  if (!changedCount) return null;
  try {
    const { clearHubCache } = require('./recruiting-hub-cache');
    const { refreshRecruitingHubCaches } = require('./recruiting-hub-refresh');
    clearHubCache();
    return await refreshRecruitingHubCaches({ geoBackfill: false, warmAfter: true });
  } catch (e) {
    return { error: e.message };
  }
}

async function reconcileCommitments(options = {}) {
  const on3 = await syncAllowlistTargetsFromOn3(options);
  const rivalsCache = await syncAllowlistTargetsFromRivals();
  const rivalsLive =
    options.fetchRivalsLive !== false && process.env.COMMITMENT_SYNC_RIVALS !== 'false'
      ? await syncLiveRivalsCommits()
      : { updated: 0, committedElsewhere: 0, errors: [] };

  const updatedCount = (on3.updated || 0) + (rivalsCache.updated || 0) + (rivalsLive.updated || 0);
  const result = {
    ok: true,
    lastRun: new Date().toISOString(),
    on3,
    rivalsCache,
    rivalsLive,
    updatedCount,
    ingestErrors: [],
  };

  const recentIngest = readJson(ON3_INGEST_LOG, []);
  const lastIngest = recentIngest[0];
  if (lastIngest?.errors > 0 || (lastIngest?.message && /premature close|fetch failed/i.test(lastIngest.message))) {
    result.ingestErrors.push({ at: lastIngest.ts, message: lastIngest.message, errors: lastIngest.errors });
    await monitoring.sendMonitoringAlert({
      level: 'warning',
      type: 'ingest_failure',
      eventType: 'commitment_sync',
      player: 'Commitment pipeline',
      detail: lastIngest.message || 'On3 ingest errors during commitment reconciliation',
      source: 'commitment-sync',
      meta: { ingestErrors: lastIngest.errors, lastIngestAt: lastIngest.ts },
    });
  }

  if (updatedCount > 0) {
    result.hubRefresh = await refreshHubAfterCommitmentChanges(updatedCount);
  }

  writeJson(STATE_PATH, {
    lastRun: result.lastRun,
    updatedCount,
    on3Failed: on3.failed?.length || 0,
    rivalsErrors: rivalsLive.errors?.length || 0,
  });

  console.log('[commitment-sync] complete', { updatedCount, on3: on3.updated, rivals: rivalsCache.updated + rivalsLive.updated });
  return result;
}

function getCommitmentSyncStatus() {
  return readJson(STATE_PATH, { lastRun: null, updatedCount: 0 });
}

function detectStaleCommitmentSync(players) {
  const stale = [];
  for (const { slug, classYear } of allowlistJobs()) {
    const row = players.find((p) => canonicalTargetSlug(p.slug) === slug);
    if (!row) {
      stale.push({ slug, classYear, reason: 'missing_player_record', hoursStale: Infinity });
      continue;
    }
    if (!isActiveUfTarget(row) && isCommittedElsewhere(row)) continue;
    const h = hoursSince(row.commitmentSyncAt || null);
    if (h >= STALE_HOURS) {
      stale.push({
        slug,
        name: row.name,
        classYear,
        reason: row.commitmentSyncAt ? 'stale_commitment_sync' : 'never_synced',
        hoursStale: Math.round(h),
      });
    }
  }
  return stale;
}

function detectIngestFailures() {
  const issues = [];
  const log = readJson(ON3_INGEST_LOG, []);
  const last = log[0];
  if (last && (last.errors > 0 || /premature close|fetch failed|ingest failed/i.test(last.message || ''))) {
    issues.push({
      severity: 'high',
      issue: 'on3_ingest_failure',
      detail: last.message || `On3 ingest reported ${last.errors || 0} error(s)`,
      lastRun: last.ts,
    });
  }
  const syncState = getCommitmentSyncStatus();
  if (hoursSince(syncState.lastRun) >= STALE_HOURS * 2) {
    issues.push({
      severity: 'medium',
      issue: 'commitment_sync_stale',
      detail: `Commitment sync last ran ${Math.round(hoursSince(syncState.lastRun))}h ago`,
      lastRun: syncState.lastRun,
    });
  }
  const snapshot = readJson(ON3_SNAPSHOT, {});
  if (snapshot.lastRun && hoursSince(snapshot.lastRun) >= STALE_HOURS * 2) {
    issues.push({
      severity: 'medium',
      issue: 'on3_snapshot_stale',
      detail: `On3 board snapshot last updated ${Math.round(hoursSince(snapshot.lastRun))}h ago`,
      lastRun: snapshot.lastRun,
    });
  }
  return issues;
}

function runCommitmentIntelligence() {
  let players = [];
  try {
    players = JSON.parse(fs.readFileSync(store.PLAYERS_PATH, 'utf8'));
  } catch {
    players = [];
  }
  const stale = detectStaleCommitmentSync(players);
  const ingestIssues = detectIngestFailures();
  const violations = [
    ...stale.map((p) => ({
      severity: p.hoursStale >= STALE_HOURS * 2 ? 'high' : 'medium',
      issue: 'stale_commitment_data',
      playerSlug: p.slug,
      playerName: p.name,
      detail: `${p.name || p.slug}: commitment data ${p.reason} (${p.hoursStale}h)`,
    })),
    ...ingestIssues,
  ];
  return {
    stale,
    ingestIssues,
    violations,
    patches: stale.length
      ? [{ patchType: 'commitment-sync-refresh', suggestedFix: `Run commitment reconciliation for ${stale.length} stale target(s)` }]
      : [],
  };
}

module.exports = {
  syncAllowlistTargetsFromOn3,
  syncAllowlistTargetsFromRivals,
  allowlistJobs,
  reconcileCommitments,
  runCommitmentIntelligence,
  getCommitmentSyncStatus,
  detectStaleCommitmentSync,
  detectIngestFailures,
  STATE_PATH,
  STALE_HOURS,
};

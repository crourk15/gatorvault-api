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
const {
  persistAllowlistPlayerToJson,
  applyAllowlistIntelSkinny,
  formatAllowlistEvalSummary,
} = require('./allowlist-school-persist');
const { isFloridaSchool, isActiveUfTarget, isCommittedElsewhere, applyHeadlinerRules, effectiveStars } = require('./recruiting-target-filters');
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
  const rp = profile.rankingsPlayer || {};
  const starCandidates = [rp.consensusStars, rp.stars, profile.stars]
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  const stars = starCandidates.length ? Math.max(...starCandidates) : profile.stars ?? null;

  const patch = {
    name: profile.name,
    pos: profile.pos || null,
    classYear: profile.classYear || classYear,
    committedTo: ufCommitted ? 'Florida' : committedTo,
    status: committedTo ? 'committed' : 'uncommitted',
    category: committedTo ? 'recruit' : 'target',
    commitDate: commit?.committedDate || null,
    on3Source: 'on3-allowlist-sync',
    stars,
    consensusStars: rp.consensusStars ?? null,
    natlRank: rp.consensusOverallRank ?? rp.consensusNationalRank ?? profile.natlRank ?? null,
    posRank: rp.consensusPositionRank ?? rp.positionRank ?? profile.posRank ?? null,
    stateRank: rp.consensusStateRank ?? rp.stateRank ?? profile.stateRank ?? null,
  };

  if (profile.school) patch.school = profile.school;
  if (profile.state) patch.state = profile.state;
  const rating = profile.rating ?? rp.consensusRating ?? rp.rating ?? null;
  if (rating != null && Number.isFinite(Number(rating))) {
    patch.rating = Number(rating);
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
    on3Source: profilePatch.on3Source || existing?.on3Source || 'on3-allowlist-sync',
    on3Slug: profilePatch.on3Slug ?? existing?.on3Slug ?? localPlayer?.on3Slug ?? null,
    on3ProfileUrl: profilePatch.on3ProfileUrl ?? existing?.on3ProfileUrl ?? localPlayer?.on3ProfileUrl ?? null,
    ufOvStatus: profilePatch.ufOvStatus ?? existing?.ufOvStatus ?? localPlayer?.ufOvStatus ?? null,
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
  const finalized = applyHeadlinerRules(applyCanonicalFixup(slug, merged));
  const stars = effectiveStars(finalized);
  if (stars) finalized.stars = stars;
  return finalized;
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

const { commitFingerprint } = require('./commit-fingerprint');
const { buildOn3ProfileUrl } = require('./on3-urls');
const { isAllowlistedTarget } = require('./recruiting-target-allowlist');
const on3Client = require('./on3-client');
const { clearHubCache } = require('./recruiting-hub-cache');
const { clearHeatCheckCache } = require('./heat-check-store');
const { normalizeIntelTimestamp } = require('./commit-fingerprint');
const TARGET_BOARD_2028 = path.join(store.DATA_DIR, '2028-target-board.json');
const ALLOWLIST_SLUGS_2028 = path.join(store.DATA_DIR, 'on3-allowlist-slugs-2028.json');
const BEAT_COMMIT_SNAPSHOT = path.join(store.DATA_DIR, 'allowlist-commit-ingest-snapshot.json');

function loadOn3RecruitSlug(slug, classYear) {
  if (parseInt(classYear, 10) !== 2028) return null;
  const doc = readJson(ALLOWLIST_SLUGS_2028, { slugs: {} });
  return doc.slugs?.[slug] || null;
}

function buildCommitSkinny(player) {
  const stars = effectiveStars(player);
  const bits = [
    player.pos,
    stars ? `${stars}-star` : null,
    player.school,
    player.natlRank ? `#${player.natlRank} natl` : null,
  ].filter(Boolean);
  return bits.join(' | ');
}

function patchTargetBoardCommit(slug, patch) {
  const doc = readJson(TARGET_BOARD_2028, { targets: [] });
  let updated = false;
  doc.targets = (doc.targets || []).map((t) => {
    if (canonicalTargetSlug(t.slug) !== canonicalTargetSlug(slug)) return t;
    updated = true;
    return { ...t, ...patch };
  });
  if (updated) {
    doc.updatedAt = new Date().toISOString();
    writeJson(TARGET_BOARD_2028, doc);
  }
  return updated;
}

function patchOn3SnapshotCommit(classYear, player) {
  const snapshot = readJson(ON3_SNAPSHOT, { initialized: false, years: {}, commitFingerprints: {} });
  snapshot.years = snapshot.years || {};
  snapshot.years[classYear] = snapshot.years[classYear] || { commits: {}, rankings: null };
  const key = on3Client.playerKey(player);
  if (!key) return false;
  snapshot.years[classYear].commits[key] = {
    on3Id: player.on3Id,
    name: player.name,
    pos: player.pos,
    classYear: player.classYear,
    school: player.school,
    htWt: player.htWt || '',
    stars: player.stars,
    rating: player.rating,
    natlRank: player.natlRank,
    posRank: player.posRank,
    stateRank: player.stateRank,
    inState: player.inState,
    status: 'committed',
    commitDate: player.commitDate,
    committedTo: 'Florida',
    skinny: player.skinny || '',
    sourceStatus: 'Committed',
  };
  const fp = commitFingerprint(player);
  if (fp) {
    snapshot.commitFingerprints = snapshot.commitFingerprints || {};
    snapshot.commitFingerprints[fp] = {
      commitDate: player.commitDate || null,
      registeredAt: new Date().toISOString(),
      source: 'allowlist_commit_ingest',
    };
  }
  writeJson(ON3_SNAPSHOT, snapshot);
  return true;
}

async function fireAllowlistCommitEvent({ player, existing, source, detail }) {
  const slug = player.slug || store.slugify(player.name);
  const wasTarget =
    existing &&
    (existing.category === 'target' ||
      existing.status === 'target' ||
      existing.status === 'uncommitted' ||
      (existing.committedTo && existing.committedTo !== 'Florida'));
  const eventType = wasTarget && existing?.committedTo !== 'Florida' ? 'flip' : 'commit';
  const copy = require('./recruiting-alert-templates').buildRecruitingCopy({
    player: { ...player, committedTo: 'Florida' },
    eventType,
    row: { detail },
  });
  return store.fireRecruitingEvent({
    eventType,
    player: {
      slug,
      name: player.name,
      pos: player.pos,
      classYear: player.classYear,
      school: player.school,
      stars: player.stars,
      rating: player.rating,
      natlRank: player.natlRank,
      posRank: player.posRank,
      stateRank: player.stateRank,
      inState: player.inState,
      category: 'recruit',
      on3Id: player.on3Id,
      commitDate: player.commitDate || null,
      committedTo: 'Florida',
      headliner: player.headliner || false,
      skinny: copy.skinny || buildCommitSkinny(player),
      profileNote: copy.profileNote,
    },
    skinny: copy.skinny || buildCommitSkinny(player),
    detail: detail || copy.profileNote,
    source: source || 'rivals_beat',
  });
}

async function ingestAllowlistCommit(opts = {}) {
  const slug = canonicalTargetSlug(opts.slug);
  if (!slug) throw new Error('slug required');

  const existing = await store.findBySlug(slug);
  const classYear = parseInt(opts.classYear || existing?.classYear || 2028, 10);
  if (!isAllowlistedTarget(existing || { slug, classYear })) {
    throw new Error(`Not on Charles allowlist: ${slug} (${classYear})`);
  }

  const on3Slug = existing?.on3Slug || loadOn3RecruitSlug(slug, classYear);
  if (!on3Slug) throw new Error(`Missing On3 recruit slug for ${slug}`);

  const profile = await on3Recruit.fetchRecruitProfile(on3Slug, classYear);
  if (!profile || profile.error) {
    throw new Error(profile?.error || `On3 profile fetch failed for ${on3Slug}`);
  }

  const profilePatch = profilePatchFromOn3(profile, classYear);
  const ufCommitted = profilePatch.committedTo === 'Florida';
  const eventTimestamp = opts.timestamp || opts.publishedAt || null;
  const commitDate =
    opts.commitDate ||
    (eventTimestamp ? String(eventTimestamp).slice(0, 10) : null) ||
    (profilePatch.commitDate ? String(profilePatch.commitDate).slice(0, 10) : null) ||
    existing?.commitDate ||
    new Date().toISOString().slice(0, 10);

  if (!ufCommitted && !opts.commitDate && !opts.forceAlert) {
    return { ok: false, slug, reason: 'on3_not_committed_to_uf', profileFetched: true };
  }

  let player = mergeAllowlistPlayerPatch(
    existing,
    localJsonPlayer(slug),
    {
      ...profilePatch,
      committedTo: 'Florida',
      status: 'committed',
      category: 'recruit',
      commitDate,
      on3Slug,
      on3Id: String(profile.rankingsPlayer?.playerId || existing?.on3Id || on3Slug.split('-').pop()),
      on3ProfileUrl: buildOn3ProfileUrl({ slug, on3Id: existing?.on3Id, on3Slug }),
      on3Source: opts.source === 'on3' ? 'on3-profile-sync' : 'allowlist-commit-ingest',
      protected: true,
      skinny: buildCommitSkinny({ ...profilePatch, commitDate }),
    },
    slug,
    classYear,
    CANONICAL_TARGET_NAMES[slug] || profile.name
  );

  const evalSummary = formatAllowlistEvalSummary(player);
  if (evalSummary) player.evaluationSummary = evalSummary;

  if (opts.dryRun) return { ok: true, dryRun: true, slug, player };

  await store.upsertPlayer(player);
  persistAllowlistPlayerToJson(slug, player);
  patchOn3SnapshotCommit(classYear, player);
  patchTargetBoardCommit(slug, {
    committedTo: 'Florida',
    stars: player.stars,
    natlRank: player.natlRank,
    headliner: player.headliner || false,
  });

  let eventResult = null;
  let autopostResult = null;
  const alreadyCommitted =
    existing?.status === 'committed' &&
    existing?.committedTo === 'Florida' &&
    existing?.commitDate === commitDate;

  const eventSource = ufCommitted ? 'on3' : opts.source || 'hayes_fawcett';
  const eventDetail =
    opts.detail ||
    `${player.name} committed to Florida${commitDate ? ` (${commitDate})` : ''}.`;

  if (!alreadyCommitted || opts.forceAlert) {
    try {
      eventResult = await fireAllowlistCommitEvent({
        player,
        existing,
        source: eventSource,
        detail: eventDetail,
      });
    } catch (e) {
      if (!/duplicate|already exists/i.test(e.message)) throw e;
      eventResult = { skipped: true, reason: e.message };
    }
  }

  try {
    const { queueCommitEventAutopost } = require('./x-autoposter-fill');
    const { commitFingerprint } = require('./commit-fingerprint');
    const sentLedger = require('./x-autoposter-sent-ledger');
    const savedPlayer = eventResult?.player || player;
    const wasTarget =
      existing &&
      (existing.category === 'target' ||
        existing.status === 'target' ||
        existing.status === 'uncommitted');
    const fp = commitFingerprint(savedPlayer);
    const eventType = wasTarget && existing?.committedTo !== 'Florida' ? 'flip' : 'commit';
    if (alreadyCommitted) {
      autopostResult = { queued: false, reason: 'already_committed', commitFingerprint: fp };
    } else if (
      sentLedger.hasRecentSentCommit({ slug, commitFingerprint: fp, eventType })
    ) {
      autopostResult = { queued: false, reason: 'already_posted', commitFingerprint: fp };
    } else {
      autopostResult = await queueCommitEventAutopost(
        {
          eventType,
          source: eventSource,
          player: savedPlayer,
          detail: eventDetail,
          skinny: savedPlayer?.skinny || buildCommitSkinny(savedPlayer),
          event: eventResult?.event || null,
          createdAt: eventTimestamp || new Date().toISOString(),
          timestamp: eventTimestamp || null,
          publishedAt: opts.publishedAt || eventTimestamp || null,
        },
        { urgent: true }
      );
    }
  } catch (e) {
    autopostResult = { queued: false, reason: e.message };
  }

  clearHubCache();
  clearHeatCheckCache();

  return {
    ok: true,
    slug,
    classYear,
    stars: effectiveStars(player),
    headliner: !!player.headliner,
    commitDate,
    on3Verified: ufCommitted,
    event: eventResult,
    autopost: autopostResult,
  };
}

const FL_COMMIT_RES = [
  /\b(?:committed|commits|verbally committed|pledged|pledges)\s+to\s+(?:the\s+)?(?:florida|gators|\buf\b)\b/i,
  /\b(?:flips?|flipped)\s+to\s+(?:the\s+)?(?:florida|gators|\buf\b)\b/i,
];

function parseBeatCommitPosts(posts) {
  const out = [];
  const seen = new Set();
  for (const post of posts || []) {
    const handle = String(post?.handle || '').toLowerCase();
    if (!/hayesfawcett3|chadsimmons_|corey_bender|gatorsonline|stevewiltfong|charlespower/.test(handle)) {
      continue;
    }
    const text = String(post.text || '').trim();
    if (!text || !FL_COMMIT_RES.some((re) => re.test(text))) continue;
    const lower = text.toLowerCase();
    let matchedSlug = null;
    for (const [slug, displayName] of Object.entries(CANONICAL_TARGET_NAMES)) {
      const parts = String(displayName).toLowerCase().split(/\s+/).filter(Boolean);
      if (parts.length < 2) continue;
      if (lower.includes(parts[0]) && lower.includes(parts[parts.length - 1])) {
        matchedSlug = canonicalTargetSlug(slug);
        break;
      }
    }
    if (!matchedSlug) continue;
    const publishedAt = post.publishedAt || post.timestamp || new Date().toISOString();
    const fp = `beat_commit_${matchedSlug}_${normalizeIntelTimestamp(publishedAt)}`;
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push({
      slug: matchedSlug,
      source: handle === 'hayesfawcett3' ? 'hayes_fawcett' : 'rivals_beat',
      detail: text.slice(0, 600),
      fingerprint: fp,
      publishedAt,
      timestamp: publishedAt,
    });
  }
  return out;
}

async function scanBeatCommitQueue({ posts, force = false } = {}) {
  const { getBeatPosts } = require('./live-beat');
  const beat = posts ? { posts } : getBeatPosts(80);
  const candidates = parseBeatCommitPosts(beat.posts || []);
  const snapshot = readJson(BEAT_COMMIT_SNAPSHOT, { fingerprints: {}, lastRun: null });
  const results = { queued: candidates.length, ingested: [], skipped: [], errors: [] };

  for (const row of candidates) {
    if (!force && snapshot.fingerprints[row.fingerprint]) {
      results.skipped.push({ slug: row.slug, reason: 'snapshot' });
      continue;
    }
    try {
      const out = await ingestAllowlistCommit({
        slug: row.slug,
        source: row.source,
        detail: row.detail,
        forceAlert: true,
        timestamp: row.timestamp || row.publishedAt || null,
        publishedAt: row.publishedAt || row.timestamp || null,
      });
      if (out.ok) {
        snapshot.fingerprints[row.fingerprint] = { slug: row.slug, ingestedAt: new Date().toISOString() };
        results.ingested.push(out);
      } else {
        results.skipped.push({ slug: row.slug, reason: out.reason || 'not_committed' });
      }
    } catch (e) {
      results.errors.push({ slug: row.slug, error: e.message });
    }
  }

  snapshot.lastRun = new Date().toISOString();
  writeJson(BEAT_COMMIT_SNAPSHOT, snapshot);
  return results;
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
  ingestAllowlistCommit,
  scanBeatCommitQueue,
  profilePatchFromOn3,
  loadOn3RecruitSlug,
  syncSlugFromOn3,
  syncSlugFromOn3Fast,
  STATE_PATH,
  STALE_HOURS,
};

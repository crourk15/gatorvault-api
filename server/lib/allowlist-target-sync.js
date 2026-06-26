/**
 * Sync allow-list target profiles from On3/Rivals into recruiting store (DB or JSON).
 */
const fs = require('fs');
const path = require('path');
const store = require('./recruiting-store');
const on3Recruit = require('./on3-recruit-client');
const { rebuildPlayerIdentityFromOn3 } = require('./identity-record-validator');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  CANONICAL_TARGET_NAMES,
  canonicalTargetSlug,
} = require('./recruiting-target-allowlist');
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
  return [
    ...ALLOWLIST_2027.map((slug) => ({ slug, classYear: 2027 })),
    ...ALLOWLIST_2028.map((slug) => ({ slug, classYear: 2028 })),
  ];
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

async function syncSlugFromOn3(slug, classYear) {
  const existing = await store.getPlayerBySlug(slug);
  const playerName = CANONICAL_TARGET_NAMES[slug] || existing?.name || slug;

  const identity = await rebuildPlayerIdentityFromOn3(slug, { classYear });
  if (identity.ok && identity.player) {
    const p = identity.player;
    const recruitSlug =
      p.on3Slug ||
      `${store.slugify(p.name || playerName)}${p.on3Id ? `-${p.on3Id}` : ''}`;
    let profilePatch = {};
    try {
      const profile = await on3Recruit.fetchRecruitProfile(recruitSlug, classYear);
      if (profile && !profile.error) {
        profilePatch = profilePatchFromOn3(profile, classYear);
      }
    } catch {
      /* profile optional */
    }

    const committedTo = profilePatch.committedTo ?? p.committedTo ?? existing?.committedTo ?? null;
    const ufCommitted = committedTo && isFloridaSchool(committedTo);

    await store.upsertPlayer({
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
    });

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
  const results = { updated: 0, ranked: 0, committedElsewhere: 0, skipped: 0, failed: [] };

  for (let i = 0; i < jobs.length; i += 1) {
    if (limit > 0 && i >= limit) break;
    const { slug, classYear } = jobs[i];
    try {
      const row = await syncSlugFromOn3(slug, classYear);
      if (row.ok) {
        results.updated += 1;
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
    if (i < jobs.length - 1) await sleep(DELAY_MS);
  }

  console.log('[allowlist-sync] On3 complete', results);
  return results;
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

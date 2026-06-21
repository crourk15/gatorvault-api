/**
 * Sync allow-list target profiles from On3/Rivals into recruiting store (DB or JSON).
 */
const store = require('./recruiting-store');
const on3Recruit = require('./on3-recruit-client');
const { rebuildPlayerIdentityFromOn3 } = require('./identity-record-validator');
const {
  ALLOWLIST_2027,
  ALLOWLIST_2028,
  CANONICAL_TARGET_NAMES,
} = require('./recruiting-target-allowlist');
const { isFloridaSchool } = require('./recruiting-target-filters');

const DELAY_MS = Math.max(250, parseInt(process.env.ON3_INGEST_DELAY_MS || '450', 10) || 450);
const RIVALS_PREDICTIONS_PATH = require('path').join(__dirname, '..', 'data', 'war-room', 'rivals-predictions.json');

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

  return {
    name: profile.name,
    pos: profile.pos || null,
    classYear: profile.classYear || classYear,
    committedTo: ufCommitted ? 'Florida' : committedTo,
    status: committedTo ? 'committed' : 'uncommitted',
    category: ufCommitted ? 'recruit' : 'target',
    commitDate: commit?.committedDate || null,
    on3Source: 'on3-allowlist-sync',
  };
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
      const profile = await on3Recruit.fetchRecruitProfile(recruitSlug);
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
      slug,
      classYear,
      name: p.name || playerName,
      pos: profilePatch.pos || p.pos || existing?.pos,
      committedTo: ufCommitted ? 'Florida' : committedTo,
      status: committedTo ? 'committed' : 'uncommitted',
      category: ufCommitted ? 'recruit' : 'target',
      commitDate: profilePatch.commitDate ?? p.commitDate ?? existing?.commitDate ?? null,
      on3Source: 'on3-allowlist-sync',
      updatedAt: new Date().toISOString(),
    });

    return {
      slug,
      classYear,
      ok: true,
      committedTo: committedTo || null,
      pos: profilePatch.pos || p.pos || null,
    };
  }

  return { slug, classYear, ok: false, error: identity.error || 'identity_failed' };
}

async function syncAllowlistTargetsFromOn3(options = {}) {
  const limit = options.limit || parseInt(process.env.ALLOWLIST_SYNC_LIMIT || '0', 10) || 0;
  const jobs = allowlistJobs();
  const results = { updated: 0, committedElsewhere: 0, skipped: 0, failed: [] };

  for (let i = 0; i < jobs.length; i += 1) {
    if (limit > 0 && i >= limit) break;
    const { slug, classYear } = jobs[i];
    try {
      const row = await syncSlugFromOn3(slug, classYear);
      if (row.ok) {
        results.updated += 1;
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
      category: ufCommitted ? 'recruit' : 'target',
      rivalsSource: 'rivals-allowlist-sync',
      updatedAt: new Date().toISOString(),
    });

    results.updated += 1;
    if (!ufCommitted) results.committedElsewhere += 1;
  }

  console.log('[allowlist-sync] Rivals complete', results);
  return results;
}

module.exports = {
  syncAllowlistTargetsFromOn3,
  syncAllowlistTargetsFromRivals,
  allowlistJobs,
};

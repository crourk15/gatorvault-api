/**
 * Editorial verified UF commits — only these slugs count as Florida commits
 * for active hub classes (2027–2029). On3 snapshot rows alone do not qualify.
 */
const { slugify } = require('./slug');

const HUB_CLASS_YEARS = new Set([2027, 2028, 2029]);

/** Locked verified UF commit slugs by class year */
const VERIFIED_UF_COMMITS_BY_YEAR = {
  2027: new Set(['tre-geathers', 'jaydee-lane', 'ellis-mcgaskin', 'aaron-mcwilliams']),
  2028: new Set(),
  2029: new Set(),
};

const ALL_VERIFIED_UF_COMMITS = new Set(
  Object.values(VERIFIED_UF_COMMITS_BY_YEAR).flatMap((set) => [...set])
);

function playerSlug(player) {
  return String(player?.slug || slugify(player?.name) || '').toLowerCase();
}

function isHubClassYear(year) {
  const y = Number(year);
  return Number.isFinite(y) && HUB_CLASS_YEARS.has(y);
}

function isVerifiedUfCommitSlug(slug, classYear) {
  const s = String(slug || '').toLowerCase();
  const year = Number(classYear);
  if (!s || !Number.isFinite(year)) return false;
  const set = VERIFIED_UF_COMMITS_BY_YEAR[year];
  return !!set && set.has(s);
}

/**
 * True when player is an editorially verified UF commit for a hub class year.
 * For non-hub years (e.g. enrolled 2026), callers should use raw commit flags instead.
 */
function isVerifiedHubCommit(player) {
  if (!player) return false;
  const year = Number(player.classYear ?? player.class_year);
  if (!isHubClassYear(year)) return true;
  return isVerifiedUfCommitSlug(playerSlug(player), year);
}

function looksLikeFloridaCommit(player) {
  if (!player) return false;
  const status = String(player.status || '').toLowerCase();
  const committedTo = String(player.committedTo || player.committed_to || '').trim();
  return (status === 'committed' || status === 'commit') && /^florida$/i.test(committedTo);
}

/** Flip targets who committed elsewhere — preserve external school when demoting false UF commits. */
const HUB_EXTERNAL_COMMIT_BY_SLUG = {
  'easton-royal': 'Texas',
};

/** Demote unverified On3-style commits back to targets for hub classes. */
function demoteUnverifiedHubCommit(player) {
  if (!player || !looksLikeFloridaCommit(player)) return player;
  const year = Number(player.classYear ?? player.class_year);
  if (!isHubClassYear(year)) return player;
  if (isVerifiedUfCommitSlug(playerSlug(player), year)) return player;

  const slug = playerSlug(player);
  const out = { ...player };
  out.status = 'uncommitted';
  out.committedTo = HUB_EXTERNAL_COMMIT_BY_SLUG[slug] || null;
  out.commitDate = null;
  out.category = 'target';
  out.lifecycle = out.lifecycle === 'commit' ? 'target' : out.lifecycle;
  out.pipelineState = out.pipelineState === 'committed' || out.pipelineState === 'commit' ? 'target' : out.pipelineState;
  if (out.ufProbability == null) out.ufProbability = null;
  return out;
}

function validateVerifiedCommits(players) {
  const errors = [];
  for (const p of players || []) {
    if (!looksLikeFloridaCommit(p)) continue;
    if (p.protected === true) continue;
    const year = Number(p.classYear ?? p.class_year);
    if (!isHubClassYear(year)) continue;
    const slug = playerSlug(p);
    if (!isVerifiedUfCommitSlug(slug, year)) {
      errors.push({
        slug,
        name: p.name,
        classYear: year,
        reason: 'unverified_florida_commit',
      });
    }
  }
  return errors;
}

function countVerifiedHubCommits(players, classYear) {
  const year = Number(classYear);
  const allowed = VERIFIED_UF_COMMITS_BY_YEAR[year];
  if (!allowed) return 0;
  let count = 0;
  for (const slug of allowed) {
    const p = (players || []).find((row) => playerSlug(row) === slug);
    if (p && looksLikeFloridaCommit(p)) count += 1;
  }
  return count;
}

/** Re-apply editorial commit status for verified allowlist slugs (sync, in-memory). */
function applyVerifiedHubCommit(player) {
  if (!player) return player;
  const slug = playerSlug(player);
  const year = Number(player.classYear ?? player.class_year);
  if (!isVerifiedUfCommitSlug(slug, year)) return player;
  if (looksLikeFloridaCommit(player)) return player;

  const out = { ...player };
  out.status = 'committed';
  out.committedTo = 'Florida';
  out.category = 'recruit';
  out.lifecycle = out.lifecycle === 'target' ? 'commit' : out.lifecycle || 'commit';
  if (out.pipelineState === 'target' || !out.pipelineState) out.pipelineState = 'committed';
  return out;
}

/** Persist verified UF commits after ingest demotions or snapshot drift. */
async function restoreVerifiedHubCommitsInStore() {
  const store = require('./recruiting-store');
  const all = await store.getAllPlayers();
  let restored = 0;
  for (const p of all) {
    const next = applyVerifiedHubCommit(p);
    if (
      next.status === p.status &&
      next.committedTo === p.committedTo &&
      next.category === p.category
    ) {
      continue;
    }
    await store.upsertPlayer({
      ...next,
      updatedAt: new Date().toISOString(),
    });
    restored += 1;
  }
  return restored;
}

module.exports = {
  HUB_CLASS_YEARS,
  VERIFIED_UF_COMMITS_BY_YEAR,
  ALL_VERIFIED_UF_COMMITS,
  isHubClassYear,
  isVerifiedUfCommitSlug,
  isVerifiedHubCommit,
  looksLikeFloridaCommit,
  demoteUnverifiedHubCommit,
  applyVerifiedHubCommit,
  restoreVerifiedHubCommitsInStore,
  validateVerifiedCommits,
  countVerifiedHubCommits,
};

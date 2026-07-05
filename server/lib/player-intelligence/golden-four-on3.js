/**
 * Golden four — verified On3 recruit slugs + targeted ingest for PR-789 rollout.
 */
const store = require('../recruiting-store');
const on3Recruit = require('../on3-recruit-client');
const { profilePatchFromOn3 } = require('../allowlist-target-sync');
const { extractOn3RankingTokens } = require('../autoposter/on3-ranking-tokens');
const { rpmTopFromOn3TopTeams } = require('../autoposter/rewrite/comp-sourcing');

/** Production slugs used in Supabase + beat pipeline. */
const GOLDEN_FOUR_PROD_SLUGS = Object.freeze([
  'ryan-drakeford',
  'man-robinson',
  'bryce-willingham',
  'merrick-ham'
]);

/** Verified public On3 /rivals/ profile slugs — never guessed. */
const GOLDEN_ON3_RECRUIT_SLUGS = Object.freeze({
  'ryan-drakeford': 'ryan-drakeford-242808',
  'man-robinson': 'man-robinson-260972',
  'bryce-willingham': 'bryce-willingham-261593',
  'merrick-ham': 'merrick-ham-281179'
});

const GOLDEN_PLAYER_DEFAULTS = Object.freeze({
  'ryan-drakeford': { name: 'Ryan Drakeford', classYear: 2028, pos: 'S' },
  'man-robinson': { name: 'Man Robinson', classYear: 2028, pos: 'CB' },
  'bryce-willingham': { name: 'Bryce Willingham', classYear: 2028, pos: 'CB' },
  'merrick-ham': { name: 'Merrick Ham', classYear: 2028, pos: 'EDGE' }
});

function isGoldenProdSlug(slug) {
  return GOLDEN_FOUR_PROD_SLUGS.includes(String(slug || '').toLowerCase());
}

function on3RecruitSlugFor(slug) {
  return GOLDEN_ON3_RECRUIT_SLUGS[String(slug || '').toLowerCase()] || null;
}

async function syncGoldenFourPlayerFromOn3(slug) {
  const key = String(slug || '').toLowerCase();
  const recruitSlug = on3RecruitSlugFor(key);
  if (!recruitSlug) {
    return { ok: false, slug: key, reason: 'not_golden_four' };
  }

  const defaults = GOLDEN_PLAYER_DEFAULTS[key] || {};
  const classYear = defaults.classYear || 2028;
  const existing = await store.getPlayerBySlug(key);

  let profile;
  try {
    profile = await on3Recruit.fetchRecruitProfile(recruitSlug, classYear);
  } catch (err) {
    return { ok: false, slug: key, recruitSlug, reason: 'fetch_failed', error: err.message };
  }

  if (!profile || profile.error) {
    return {
      ok: false,
      slug: key,
      recruitSlug,
      reason: 'profile_error',
      error: profile?.error || 'missing_profile'
    };
  }

  const profilePatch = profilePatchFromOn3(profile, classYear);
  const on3Id = recruitSlug.match(/-(\d+)$/)?.[1] || existing?.on3Id || null;
  const ufTeam = on3Recruit.getFloridaTeam(profile.topTeams, classYear);
  const ufRpmPct = ufTeam?.prediction != null ? Number(ufTeam.prediction) : existing?.ufRpmPct ?? null;
  const rpmTop = rpmTopFromOn3TopTeams(profile.topTeams || [], classYear);
  const competitorsFromBoard = rpmTop.map((row) => ({
    school: row.school,
    score: row.pct,
    pct: row.pct
  }));
  const merged = {
    ...(existing || {}),
    slug: key,
    id: existing?.id || key,
    name: profilePatch.name || defaults.name || existing?.name,
    pos: profilePatch.pos || defaults.pos || existing?.pos,
    classYear: profilePatch.classYear || classYear,
    ...profilePatch,
    on3Id,
    on3Slug: recruitSlug,
    on3TopTeams: profile.topTeams || [],
    topTeams: profile.topTeams || [],
    competitors: competitorsFromBoard.length ? competitorsFromBoard : existing?.competitors || [],
    ufRpmPct: ufRpmPct != null && Number.isFinite(ufRpmPct) ? ufRpmPct : existing?.ufRpmPct ?? null,
    hometownState: profile.state || profilePatch.state || existing?.hometownState || null,
    hometownCity: profile.hometownCity || existing?.hometownCity || null,
    on3ProfileUrl: profile.on3ProfileUrl || `https://www.on3.com/rivals/${recruitSlug}/`,
    on3Source: 'golden-four-on3-sync',
    updatedAt: new Date().toISOString()
  };

  await store.upsertPlayer(merged);

  const rankingTokens = extractOn3RankingTokens(merged);
  return {
    ok: true,
    slug: key,
    recruitSlug,
    rankingValid: rankingTokens != null,
    rankingTokens,
    stars: merged.stars,
    natlRank: merged.natlRank,
    posRank: merged.posRank,
    stateRank: merged.stateRank
  };
}

async function syncAllGoldenFourFromOn3() {
  const results = [];
  for (const slug of GOLDEN_FOUR_PROD_SLUGS) {
    results.push(await syncGoldenFourPlayerFromOn3(slug));
  }
  const status = await getGoldenFourRankingStatus(results);
  return { ok: true, results, status };
}

let goldenFourRankingComplete = null;
let goldenFourRankingCheckedAt = 0;

async function refreshGoldenFourRankingCache() {
  const status = await getGoldenFourRankingStatus();
  goldenFourRankingComplete = status.complete === true;
  goldenFourRankingCheckedAt = Date.now();
  return status;
}

function isGoldenFourRankingComplete() {
  return goldenFourRankingComplete === true;
}

/** Test-only — bypass async store reads in unit tests. */
function setGoldenFourRankingCompleteForTests(complete) {
  goldenFourRankingComplete = complete === true;
  goldenFourRankingCheckedAt = Date.now();
}

async function getGoldenFourRankingStatus(prefetchedResults = null) {
  const players = [];
  let complete = true;

  for (const slug of GOLDEN_FOUR_PROD_SLUGS) {
    let rankingValid = false;
    let rankingTokens = null;

    if (Array.isArray(prefetchedResults)) {
      const hit = prefetchedResults.find((r) => r.slug === slug);
      rankingValid = hit?.rankingValid === true;
      rankingTokens = hit?.rankingTokens || null;
    }

    if (!rankingValid) {
      const player = await store.getPlayerBySlug(slug);
      rankingTokens = player ? extractOn3RankingTokens(player) : null;
      rankingValid = rankingTokens != null;
    }

    if (!rankingValid) complete = false;
    players.push({ slug, rankingValid, rankingTokens });
  }

  return {
    complete,
    players,
    checkedAt: new Date().toISOString()
  };
}

module.exports = {
  GOLDEN_FOUR_PROD_SLUGS,
  GOLDEN_ON3_RECRUIT_SLUGS,
  GOLDEN_PLAYER_DEFAULTS,
  isGoldenProdSlug,
  on3RecruitSlugFor,
  syncGoldenFourPlayerFromOn3,
  syncAllGoldenFourFromOn3,
  getGoldenFourRankingStatus,
  refreshGoldenFourRankingCache,
  isGoldenFourRankingComplete,
  setGoldenFourRankingCompleteForTests
};

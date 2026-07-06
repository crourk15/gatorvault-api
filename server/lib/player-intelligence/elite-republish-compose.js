/**
 * Full elite republish — refresh On3/scouting stack, fuse intel, PR-789 compose with rankings.
 */
const recruitingStore = require('../recruiting-store');
const on3Recruit = require('../on3-recruit-client');
const { profilePatchFromOn3 } = require('../allowlist-target-sync');
const { extractOn3RankingTokens } = require('../autoposter/on3-ranking-tokens');
const { rpmTopFromOn3TopTeams } = require('../autoposter/rewrite/comp-sourcing');
const { validateBannedPhrases } = require('../autoposter/rewrite/fact-gates');
const { composeGoldenFourFactPost } = require('./golden-four-compose');
const { fusePlayerIntel } = require('./fuse-player-intel');
const { getPlayerIntelligence } = require('./index');
const { refreshPlayerIntelligence } = require('./orchestrator');
const { syncGoldenFourPlayerFromOn3, isGoldenProdSlug } = require('./golden-four-on3');

const ELITE_COMPOSE_PATH = 'elite_pr789';

function normalizeSlug(slug) {
  return String(slug || '').trim().toLowerCase();
}

function hasCompleteRankingTokens(tokens = null) {
  if (!tokens) return false;
  return (
    tokens.on3Stars != null &&
    tokens.on3NationalRank != null &&
    tokens.on3PositionRank != null &&
    tokens.on3StateRank != null
  );
}

function identityHasRankingLine(identityLine = '') {
  return /On3 No\.\s*\d+\s*natl/i.test(String(identityLine || ''));
}

function serializeProbeEliteBuild(eliteBuild) {
  if (!eliteBuild?.ok) {
    return {
      ok: false,
      reason: eliteBuild?.reason || 'elite_compose_failed',
      stackErrors: eliteBuild?.stackErrors || null,
      on3Sync: eliteBuild?.on3Sync
        ? {
            stars: eliteBuild.on3Sync.stars,
            natlRank: eliteBuild.on3Sync.natlRank,
            posRank: eliteBuild.on3Sync.posRank,
            stateRank: eliteBuild.on3Sync.stateRank,
            rankingTokens: eliteBuild.on3Sync.rankingTokens || null
          }
        : null
    };
  }
  const meta = eliteBuild.validationMeta || {};
  return {
    ok: true,
    composePath: meta.composePath || ELITE_COMPOSE_PATH,
    preview: String(eliteBuild.text || '').slice(0, 240),
    rankingTokens: meta.rankingTokens || null,
    identity: eliteBuild.templateBlocks?.identity || null,
    insider: eliteBuild.templateBlocks?.insider || null,
    rpmTop: meta.voiceMetrics?.rpmTop || [],
    scoutingRefresh: meta.scoutingRefresh || null,
    pr789AngleLive: !!meta.pr789AngleLive,
    pr789Live: !!meta.pr789Live,
    pr789Shadow: meta.pr789Shadow || null,
    pr789AngleShadow: meta.pr789AngleShadow || null,
    pr6Shadow: meta.pr6Shadow || null,
    pr789Text: meta.pr789Text || meta.pr789AngleText || null,
    compositeScore: meta.compositeScore ?? null
  };
}

function validateEliteStack(built) {
  const errors = [];
  const meta = built?.validationMeta || {};
  if (meta.composePath !== ELITE_COMPOSE_PATH) errors.push('compose_path_not_elite_pr789');
  if (!hasCompleteRankingTokens(meta.rankingTokens)) errors.push('ranking_tokens_incomplete');
  if (!identityHasRankingLine(built?.templateBlocks?.identity)) errors.push('identity_missing_ranking_suffix');
  if (!meta.pr789AngleLive && !meta.pr789Shadow?.ok && !meta.pr789AngleShadow?.ok) {
    errors.push('pr_shadow_missing');
  }
  if (!meta.scoutingRefresh?.rankingValid) errors.push('scouting_refresh_invalid');
  return { ok: errors.length === 0, errors };
}

function buildOn3Sync(playerIntel, playerRow, on3Refresh = null) {
  const rankingTokens =
    playerIntel?.rankingTokens ||
    on3Refresh?.rankingTokens ||
    extractOn3RankingTokens(playerRow);
  return {
    ok: !!(rankingTokens || on3Refresh?.ok),
    rankingValid: playerIntel?.rankingBlock?.valid === true || rankingTokens != null,
    rankingTokens,
    stars: playerRow?.stars ?? rankingTokens?.on3Stars ?? null,
    natlRank: playerRow?.natlRank ?? rankingTokens?.on3NationalRank ?? null,
    posRank: playerRow?.posRank ?? rankingTokens?.on3PositionRank ?? null,
    stateRank: playerRow?.stateRank ?? rankingTokens?.on3StateRank ?? null
  };
}

function enrichPlayerRow(playerRow, playerIntel) {
  if (!playerRow) return null;
  const classYear = playerRow.classYear || 2028;
  let competitors = (playerIntel?.competitors || playerRow.competitors || [])
    .map((row) => ({
      school: row.school || row.name,
      pct: row.pct != null ? Number(row.pct) : row.score != null ? Number(row.score) : null
    }))
    .filter((row) => row.school);

  if (competitors.length < 2) {
    const rpmTop = rpmTopFromOn3TopTeams(playerRow.on3TopTeams || playerRow.topTeams || [], classYear);
    if (rpmTop.length >= 2) {
      competitors = rpmTop.map((row) => ({ school: row.school, pct: row.pct }));
    }
  }

  return {
    ...playerRow,
    competitors,
    ufRpmPct:
      playerIntel?.rpm?.ufPct != null
        ? Number(playerIntel.rpm.ufPct)
        : playerRow.ufRpmPct != null
          ? Number(playerRow.ufRpmPct)
          : null
  };
}

function resolveOn3RecruitSlug(slug, playerRow, intelRow = null) {
  if (playerRow?.on3Slug) return playerRow.on3Slug;
  try {
    const { loadOn3RecruitSlug } = require('../allowlist-target-sync');
    const fromAllowlist = loadOn3RecruitSlug(slug, playerRow?.classYear || intelRow?.classYear || 2028);
    if (fromAllowlist) return fromAllowlist;
  } catch {
    /* optional */
  }
  const on3Id = playerRow?.on3Id || intelRow?.playerId || null;
  if (on3Id && slug && /^\d+$/.test(String(on3Id))) {
    return `${slug}-${on3Id}`;
  }
  return null;
}

async function ensureRankingProfile(slug, playerRow, intelRow = null) {
  let row = playerRow;
  let tokens = extractOn3RankingTokens(row);
  if (tokens) return { playerRow: row, rankingTokens: tokens };

  const recruitSlug = resolveOn3RecruitSlug(slug, row, intelRow);
  if (!recruitSlug) return { playerRow: row, rankingTokens: null };

  try {
    const profile = await on3Recruit.fetchRecruitProfile(recruitSlug, row.classYear || 2028);
    if (!profile || profile.error) return { playerRow: row, rankingTokens: null };
    const patch = profilePatchFromOn3(profile, row.classYear || 2028);
    row = {
      ...row,
      ...patch,
      on3Slug: recruitSlug,
      hometownState: patch.state || row.hometownState || row.state || null,
      state: patch.state || row.state || row.hometownState || null,
      on3TopTeams: profile.topTeams || row.on3TopTeams || [],
      topTeams: profile.topTeams || row.topTeams || [],
      competitors: rpmTopFromOn3TopTeams(profile.topTeams || [], row.classYear || 2028).map((entry) => ({
        school: entry.school,
        pct: entry.pct,
        score: entry.pct
      })),
      updatedAt: new Date().toISOString()
    };
    await recruitingStore.upsertPlayer(row);
    tokens = extractOn3RankingTokens(row);
    return { playerRow: row, rankingTokens: tokens };
  } catch {
    return { playerRow: row, rankingTokens: null };
  }
}

function buildPrSignal(slug, intel, on3Sync, playerRow, beatText) {
  const rankingTokens = on3Sync?.rankingTokens || null;
  const classYear = playerRow?.classYear || intel?.classYear || 2028;
  const rpmTop = rpmTopFromOn3TopTeams(playerRow?.on3TopTeams || playerRow?.topTeams || [], classYear);
  const competitors = enrichPlayerRow(playerRow, { competitors: playerRow?.competitors })?.competitors || [];
  const rpmFromComp =
    competitors.length >= 2
      ? competitors.map((row) => ({ school: row.school, pct: row.pct }))
      : rpmTop;

  return {
    player: {
      name: intel.playerName || playerRow?.name,
      classYear,
      pos: playerRow?.pos || intel?.pos || null,
      rankingTokens,
      stars: on3Sync?.stars ?? rankingTokens?.on3Stars ?? null,
      natlRank: on3Sync?.natlRank ?? rankingTokens?.on3NationalRank ?? null,
      posRank: on3Sync?.posRank ?? rankingTokens?.on3PositionRank ?? null,
      stateRank: on3Sync?.stateRank ?? rankingTokens?.on3StateRank ?? null,
      state: playerRow?.hometownState || playerRow?.state || null,
      hometownState: playerRow?.hometownState || playerRow?.state || null
    },
    playerSlug: slug,
    beatText,
    metrics: {
      rpmTop: rpmFromComp,
      ufRpmPct: playerRow?.ufRpmPct != null ? Number(playerRow.ufRpmPct) : null,
      rpm: playerRow?.ufRpmPct != null ? Number(playerRow.ufRpmPct) : null
    }
  };
}

function attachElitePrStack(composed, signal) {
  let metadata = { ...(composed.validationMeta || {}) };
  try {
    const voiceEngine = require('../autoposter/voice-engine');
    if (typeof voiceEngine.attachPr6Shadow === 'function') {
      const blocks = {
        identity: { line: composed.templateBlocks?.identity || '' },
        intel: composed.templateBlocks?.context || '',
        context: '',
        strategy: composed.templateBlocks?.insider || '',
        hook: null,
        cta: composed.templateBlocks?.cta || ''
      };
      metadata = voiceEngine.attachPr6Shadow(signal, blocks, composed.text, metadata);
    }
  } catch {
    /* optional */
  }
  return metadata;
}

/**
 * @param {string} slug
 * @param {object} [opts]
 * @param {object} [opts.intelRow]
 * @param {object} [opts.fused]
 * @param {boolean} [opts.refreshOn3=true]
 * @param {boolean} [opts.persistFusion=true]
 */
async function buildEliteRepublishPost(slug, opts = {}) {
  const normalized = normalizeSlug(slug);
  if (!normalized) return { ok: false, reason: 'missing_slug' };

  const skipRefresh = opts.refreshOn3 === false && opts._testSkipRefresh === true;
  let on3Refresh = null;
  if (!skipRefresh) {
    if (isGoldenProdSlug(normalized)) {
      on3Refresh = await syncGoldenFourPlayerFromOn3(normalized);
    } else {
      on3Refresh = await refreshPlayerIntelligence(normalized, { force: true });
    }
  }

  let playerRow = await recruitingStore.getPlayerBySlug(normalized);
  const rankingEnsure = await ensureRankingProfile(normalized, playerRow, opts.intelRow);
  playerRow = rankingEnsure.playerRow || playerRow;

  const playerIntel = await getPlayerIntelligence(normalized);
  const on3Sync = buildOn3Sync(playerIntel, playerRow, on3Refresh?.on3Refresh || on3Refresh);
  if (!hasCompleteRankingTokens(on3Sync.rankingTokens)) {
    return {
      ok: false,
      reason: 'ranking_incomplete',
      on3Sync,
      on3Refresh,
      playerIntel: playerIntel
        ? {
            rankingValid: playerIntel.rankingBlock?.valid,
            gaps: playerIntel.gaps || []
          }
        : null
    };
  }

  const fused = opts.fused || (await fusePlayerIntel(normalized, { persist: opts.persistFusion !== false }));
  if (!fused?.beatText) {
    return { ok: false, reason: 'missing_fused_intel', on3Refresh, on3Sync };
  }

  const intelRow = opts.intelRow || fused.primaryIntelRow || {};
  const intel = {
    ...intelRow,
    playerName: playerIntel?.identity?.name || intelRow.playerName || playerRow?.name,
    playerSlug: normalized,
    detail: fused.beatText,
    skinny: fused.beatText,
    classYear: playerRow?.classYear || intelRow.classYear,
    pos: playerRow?.pos || intelRow.pos
  };

  const enrichedRow = enrichPlayerRow(playerRow, playerIntel);
  const composed = composeGoldenFourFactPost({
    slug: normalized,
    intel,
    on3Sync,
    playerRow: enrichedRow,
    composePath: ELITE_COMPOSE_PATH
  });

  if (!composed?.ok || !composed.text) {
    return {
      ok: false,
      reason: composed?.reason || 'compose_failed',
      on3Sync,
      on3Refresh,
      composed
    };
  }

  if (!identityHasRankingLine(composed.templateBlocks?.identity)) {
    return { ok: false, reason: 'identity_missing_ranking_suffix', on3Sync, composed };
  }

  const banned = validateBannedPhrases(composed.text);
  if (!banned.ok) {
    return { ok: false, reason: 'banned_phrases', violations: banned.violations, on3Sync };
  }

  const signal = buildPrSignal(normalized, intel, on3Sync, enrichedRow, fused.beatText);
  let validationMeta = attachElitePrStack(composed, signal);

  let compositeScore = null;
  try {
    const policy = require('../x-autoposter-policy');
    const check = policy.validatePostContent({
      text: composed.text,
      category: 'news',
      topic: 'recruiting',
      playerSlug: normalized,
      templateBlocks: composed.templateBlocks,
      validationMeta
    });
    compositeScore = check.qualityScore ?? null;
    validationMeta = {
      ...validationMeta,
      compositeScore,
      qualityBreakdown: check.qualityBreakdown ?? null,
      sourceConfidence: check.sourceConfidence ?? null
    };
  } catch {
    /* optional */
  }

  validationMeta = {
    ...validationMeta,
    eliteCompose: true,
    eliteBeatIntel: true,
    eliteRepublish: true,
    fusedIntelCompose: true,
    pr789AngleLive: true,
    publishTier: 'pr789_angle',
    composePath: ELITE_COMPOSE_PATH,
    voiceEngine: true,
    beatText: fused.beatText,
    fuseConfidence: fused.confidence,
    fusePublishAction: fused.publishAction,
    fuseGapCount: fused.gaps?.length || 0,
    rankingTokens: on3Sync.rankingTokens,
    voiceMetrics: {
      ...(composed.validationMeta?.voiceMetrics || {}),
      rpmTop: signal.metrics.rpmTop,
      ufRpmPct: signal.metrics.ufRpmPct,
      rankingTokens: on3Sync.rankingTokens
    },
    scoutingRefresh: {
      on3Refresh: skipRefresh ? false : on3Refresh?.ok !== false,
      rankingValid: true,
      natlRank: on3Sync.natlRank,
      posRank: on3Sync.posRank,
      stateRank: on3Sync.stateRank,
      stars: on3Sync.stars,
      refreshedAt: new Date().toISOString()
    },
    playerIntel: {
      rankingBlockValid: playerIntel?.rankingBlock?.valid === true,
      coverageTier: playerIntel?.coverageTier || null,
      gapCount: playerIntel?.gaps?.length || 0
    }
  };

  const result = {
    ok: true,
    text: composed.text,
    playerName: composed.playerName,
    playerSlug: composed.playerSlug || normalized,
    templateBlocks: composed.templateBlocks,
    validationMeta,
    eliteStack: {
      on3Sync,
      on3Refresh,
      rankingTokens: on3Sync.rankingTokens,
      identity: composed.templateBlocks?.identity || null,
      insider: composed.templateBlocks?.insider || null,
      rpmTop: signal.metrics.rpmTop,
      fusedConfidence: fused.confidence
    }
  };

  const stackCheck = validateEliteStack(result);
  if (!stackCheck.ok) {
    return { ok: false, reason: 'elite_stack_incomplete', stackErrors: stackCheck.errors, ...result };
  }

  return result;
}

module.exports = {
  buildEliteRepublishPost,
  buildOn3Sync,
  enrichPlayerRow,
  ensureRankingProfile,
  hasCompleteRankingTokens,
  resolveOn3RecruitSlug,
  validateEliteStack,
  serializeProbeEliteBuild,
  ELITE_COMPOSE_PATH
};

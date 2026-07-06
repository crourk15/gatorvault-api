/**
 * Golden-four fact-driven compose — PR-789 angle only, never PR-6 template fallback.
 */
const signalAdapter = require('../autoposter/voice-signal-adapter');
const {
  extractBeatFacts,
  selectAngleFromFacts,
  composeFromFacts
} = require('../autoposter/rewrite/beat-fact-extractor');
const { buildIdentityWithRanking } = require('../autoposter/rewrite/enhance-engine');
const {
  validateBannedPhrases,
  hasFactCompletenessForPr789
} = require('../autoposter/rewrite/fact-gates');
const { rpmTopFromOn3TopTeams } = require('../autoposter/rewrite/comp-sourcing');
const { getTweetCharLimit } = require('../autoposter/tweet-char-limit');
const { GOLDEN_PLAYER_DEFAULTS } = require('./golden-four-on3');

const PR6_FALLBACK_RE =
  /\bgave Florida a foothold\b|\bput UF on his board early\b|\bpositioned early in (?:this cycle|his recruitment)\b/i;

function playerCta(slug) {
  const url = signalAdapter.buildPlayerUrl(slug, { playerSlug: slug, eventType: 'recruiting' });
  return String(url || '').replace(/^https?:\/\//i, '');
}

function rpmTopFromPlayer(player = {}, classYear = 2028) {
  if (Array.isArray(player.competitors) && player.competitors.length >= 2) {
    return player.competitors
      .map((row) => ({
        school: row.school || row.name,
        pct: row.pct != null ? Number(row.pct) : row.score != null ? Number(row.score) : null
      }))
      .filter((row) => row.school);
  }
  return rpmTopFromOn3TopTeams(player.on3TopTeams || player.topTeams || [], classYear);
}

function buildInsiderLine(rpmTop = []) {
  if (rpmTop.length >= 2) {
    return `${rpmTop[0].school} and ${rpmTop[1].school} lead his RPM board, but UF is clearly in the mix.`;
  }
  if (rpmTop.length === 1) {
    return `${rpmTop[0].school} leads his RPM board, but UF is still in the mix.`;
  }
  return '';
}

/**
 * @param {object} params
 * @param {string} params.slug
 * @param {object} params.intel — beat intel row
 * @param {object} [params.on3Sync] — syncGoldenFourPlayerFromOn3 result
 * @param {object} [params.playerRow] — recruiting store player
 * @param {string} [params.composePath] — probe/diagnostic compose path id
 */
function composeGoldenFourFactPost({ slug, intel, on3Sync = null, playerRow = null, composePath = 'pr789_beat_facts' } = {}) {
  const beatText = String(intel?.detail || intel?.skinny || '').trim();
  if (!beatText) return { ok: false, reason: 'missing_beat_text' };

  try {
    const { detectBeatIdentityMismatch } = require('../autoposter/beat-identity-guard');
    const mismatch = detectBeatIdentityMismatch(slug, intel?.playerName || playerRow?.name, beatText, {
      fingerprint: intel?.fingerprint || null
    });
    if (mismatch.mismatch) {
      return {
        ok: false,
        reason: 'beat_identity_mismatch',
        mismatchReason: mismatch.reason,
        mentionedName: mismatch.mentionedName || null,
        mentionedSlug: mismatch.mentionedSlug || null
      };
    }
  } catch {
    /* optional */
  }

  const defaults = GOLDEN_PLAYER_DEFAULTS[slug] || {};
  const playerName = intel?.playerName || playerRow?.name || defaults.name;
  if (!playerName) return { ok: false, reason: 'missing_player_name' };

  const classYear = playerRow?.classYear || defaults.classYear || 2028;
  const pos = playerRow?.pos || defaults.pos || null;
  const rankingTokens = on3Sync?.rankingTokens || null;
  const rpmTop = rpmTopFromPlayer(playerRow || {}, classYear);
  const ufRpmPct =
    playerRow?.ufRpmPct != null && Number.isFinite(Number(playerRow.ufRpmPct))
      ? Number(playerRow.ufRpmPct)
      : null;

  const signal = {
    player: {
      name: playerName,
      classYear,
      pos,
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
      rpmTop,
      ufRpmPct,
      rpm: ufRpmPct
    }
  };

  const facts = extractBeatFacts(beatText, {
    signal,
    metrics: signal.metrics,
    player: signal.player
  });

  if (!hasFactCompletenessForPr789(facts, beatText)) {
    return { ok: false, reason: 'intel_incomplete', facts, angle: null };
  }

  const anglePick = selectAngleFromFacts(facts, beatText);
  const lastName = String(playerName).trim().split(/\s+/).pop();
  const ctx = { lastName, beatText };
  const hasRpmTop = rpmTop.length >= 2;
  const composeAttempts = [
    { mode: 'elite', trimComp: !hasRpmTop },
    { mode: 'elite', eliteShort: anglePick.angle === 'staff', trimComp: true },
    { mode: 'elite', eliteShort: true, trimComp: true }
  ];

  let narrative = null;
  for (const composeOpts of composeAttempts) {
    const composed = composeFromFacts(facts, anglePick, ctx, composeOpts);
    if (composed?.narrative) {
      narrative = composed.narrative;
      break;
    }
  }
  if (!narrative) return { ok: false, reason: 'compose_failed', facts, angle: anglePick.angle };

  const identityBase = [classYear, pos, playerName].filter(Boolean).join(' ').trim();
  let identityLine = buildIdentityWithRanking(identityBase, signal);
  const cta = playerCta(slug);
  const insiderLine = buildInsiderLine(rpmTop);
  let text = [identityLine, narrative, cta].filter(Boolean).join('\n');

  if (text.length > getTweetCharLimit()) {
    const compactIdentity = buildIdentityWithRanking(identityBase, signal, { compact: true });
    identityLine = compactIdentity || identityLine;
    const shortNarrative = composeFromFacts(facts, anglePick, ctx, {
      mode: 'elite',
      eliteShort: true,
      trimComp: true
    }).narrative;
    text = [identityLine, shortNarrative, cta].filter(Boolean).join('\n');
  }

  if (PR6_FALLBACK_RE.test(text)) {
    return { ok: false, reason: 'pr6_fallback_blocked', text: text.slice(0, 280) };
  }

  const banned = validateBannedPhrases(text);
  if (!banned.ok) {
    return { ok: false, reason: 'banned_phrases', violations: banned.violations, text: text.slice(0, 280) };
  }

  if (text.length > getTweetCharLimit()) {
    return { ok: false, reason: 'char_limit', charCount: text.length };
  }

  return {
    ok: true,
    text,
    playerName,
    playerSlug: slug,
    templateBlocks: {
      identity: identityLine,
      context: narrative,
      insider: insiderLine,
      cta
    },
    validationMeta: {
      eliteCompose: true,
      goldenFourFactCompose: true,
      goldenFourEnqueue: true,
      pr789AngleLive: true,
      publishTier: 'pr789_angle',
      dominantAngle: anglePick.angle,
      composePath,
      angleReason: anglePick.reason,
      voiceEngine: true,
      eliteBeatIntel: true,
      beatText,
      voiceMetrics: {
        rpmTop,
        ufRpmPct,
        rankingTokens
      }
    }
  };
}

module.exports = {
  composeGoldenFourFactPost,
  PR6_FALLBACK_RE
};

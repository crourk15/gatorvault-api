/**
 * Detectives v1.0 — classify skipped cases into tactical skip codes + diagnosis.
 */
const handoff = require('./detectives-handoff');
const store = require('./detectives-store');

/** PR1 skip codes — extend in PR2 (NO_RPM_DATA, etc.). */
const SKIP_CODES = Object.freeze([
  'IDENTITY_INCOMPLETE',
  'NO_RECRUITING_SIGNAL',
  'STRATEGY_DATA_MISSING',
  'BEAT_QUOTE_ONLY',
  'BEAT_AMBIGUOUS',
  'BEAT_NO_PLAYER',
  'BEAT_NO_EVENT',
  'HUB_NOT_PROVISIONED',
  'CHAR_LIMIT_FAIL',
  '3GRAM_OVERLAP_FAIL',
  'DATA_INCONSISTENT',
  'MISSING_SITUATION',
  'COPY_FAILED',
  'QUALITY_GATE',
  'NO_RPM_DATA',
  'NO_VISIT_DATA',
  'NO_COMP_DATA',
  'UNKNOWN'
]);

const KNOWN_SALVAGEABLE = new Set([
  'STRATEGY_DATA_MISSING',
  'IDENTITY_INCOMPLETE',
  'MISSING_SITUATION',
  'HUB_NOT_PROVISIONED',
  'COPY_FAILED',
  'QUALITY_GATE',
  'NO_RECRUITING_SIGNAL'
]);

function beatTextFromCase(caseItem) {
  return handoff.beatTextFromPayload(caseItem || {});
}

function rawSkipReason(caseItem) {
  return String(caseItem?.skipReasonRaw || caseItem?.skipReason || '').trim();
}

function caseContext(caseItem) {
  const hints = caseItem?.hints || {};
  const cand = caseItem?.candidate || {};
  const beat = caseItem?.beatPost || {};
  const platformLog = (caseItem?.investigationLog || []).filter((l) => l.phase === 'platform').pop();
  const identityLog = (caseItem?.investigationLog || []).filter((l) => l.phase === 'identity').pop();
  const meta = cand.validationMeta || caseItem?.validationMeta || {};

  let playerName = cand.playerName || hints.playerName || beat.playerName || identityLog?.playerName || null;
  let playerSlug = cand.playerSlug || hints.playerSlug || beat.playerSlug || identityLog?.playerSlug || null;

  if (!playerName) {
    try {
      const copy = require('../x-autoposter-copy');
      playerName = copy.extractPlayerFromText(beatTextFromCase(caseItem));
      if (playerName && !copy.isValidPlayerName(playerName)) playerName = null;
    } catch {
      playerName = null;
    }
  }

  const metrics = meta.voiceMetrics || hints.metrics || cand.metrics || {};

  return {
    hints,
    cand,
    beat,
    playerName,
    playerSlug,
    classYear: cand.classYear || hints.classYear || null,
    pos: cand.pos || hints.pos || null,
    metrics,
    platformProvisioned: platformLog?.provisioned === true,
    platformOk: platformLog?.ok === true,
    hasFutureCastContext: platformLog?.hasFutureCastContext === true
  };
}

function hasOn3Link(text) {
  return /\bon3\.com\b/i.test(String(text || '')) || /\bon3\+\b/i.test(String(text || ''));
}

function hasPlayerName(caseItem, ctx = null) {
  const c = ctx || caseContext(caseItem);
  if (c.playerName && c.playerSlug) return true;
  try {
    const copy = require('../x-autoposter-copy');
    const name = copy.extractPlayerFromText(beatTextFromCase(caseItem));
    return !!(name && copy.isValidPlayerName(name));
  } catch {
    return false;
  }
}

function hasClassYearInBeat(caseItem, ctx) {
  if (ctx?.classYear) return true;
  return /\b20(?:2[7-9]|3[0-2])\b/.test(beatTextFromCase(caseItem));
}

function hasPosition(ctx, caseItem) {
  if (ctx.pos) return true;
  return /\b(?:QB|RB|WR|TE|OL|OT|OG|C|DL|DT|DE|EDGE|LB|CB|S|ATH|IOL)\b/i.test(beatTextFromCase(caseItem));
}

function hasRPM(ctx) {
  const m = ctx.metrics || {};
  return m.rpm != null && Number(m.rpm) > 0;
}

function hasVisit(ctx) {
  const m = ctx.metrics || {};
  return !!(m.visitDate || m.visitStart);
}

function hasComp(ctx) {
  const m = ctx.metrics || {};
  return Array.isArray(m.compSchools) && m.compSchools.length > 0;
}

function hasDepth(ctx) {
  const m = ctx.metrics || {};
  return !!(m.depthChartNote || m.schemeNote);
}

function hubNotProvisioned(caseItem, ctx) {
  if (ctx.platformProvisioned || ctx.platformOk) return false;
  const log = (caseItem?.investigationLog || []).find((l) => l.phase === 'platform');
  if (log && log.provisioned === true) return false;
  if (ctx.playerSlug) return false;
  return true;
}

function isBeatQuoteOnly(text) {
  const t = String(text || '');
  if (!t) return true;
  if (hasOn3Link(t) && hasPlayerName({ beatPost: { text: t } })) return false;
  if (/\b(?:two-way standout|prospect|target|recruit)\b/i.test(t) && !hasPlayerName({ beatPost: { text: t } })) {
    return true;
  }
  if (/^(?:NEW:|BREAKING:)?\s*["“]/i.test(t) && !/\b20(?:2[7-9]|3[0-2])\b/.test(t)) return true;
  if (/\b(?:delivered a message|really stuck with|getting to know)\b/i.test(t) && !hasPlayerName({ beatPost: { text: t } })) {
    return true;
  }
  return false;
}

function isBeatAmbiguous(text) {
  const t = String(text || '');
  if (!t) return true;
  if (/\b(?:two-way standout|the prospect|this target|a priority|one of the)\b/i.test(t) && !hasPlayerName({ beatPost: { text: t } })) {
    return true;
  }
  if (/\b(?:staff met with|checked in with)\b/i.test(t) && !/\b[A-Z][a-z]+ [A-Z][a-z]+\b/.test(t)) return true;
  return false;
}

function hasEvent(text) {
  const t = String(text || '');
  return /\b(?:visit|commit|offer|flip|decommit|rpm|prediction|decision|portal|official|unofficial|swamp|campus)\b/i.test(
    t
  );
}

function isCommitArticle(text) {
  return /\b(?:commit(?:ment)?|commits to|flips to|pledges|decision day|sets commitment date)\b/i.test(String(text || ''));
}

function isTeaser(text) {
  return isBeatQuoteOnly(text) || /\b(?:more coming|stay tuned|👀)\s*$/i.test(String(text || '').trim());
}

function isListicle(text) {
  return handoff.isJunkBeatText(text) || /\b(?:top \d+|greatest runs|getting to know:)\b/i.test(String(text || ''));
}

function mentionsUpdate(text) {
  return /\b(?:update|latest|revisiting|still the call|momentum|trending)\b/i.test(String(text || ''));
}

function classifyBeatKind(text) {
  if (isListicle(text)) return 'listicle';
  if (isTeaser(text)) return 'teaser';
  if (mentionsUpdate(text)) return 'update';
  if (isCommitArticle(text)) return 'commit';
  return 'other';
}

function dataInconsistent(caseItem, ctx) {
  const beat = beatTextFromCase(caseItem);
  if (!ctx.playerName) return false;
  const last = String(ctx.playerName).trim().split(/\s+/).pop();
  if (!last) return false;
  return !new RegExp(`\\b${last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(beat);
}

function mapRawReasonToSkipCode(raw, caseItem) {
  const beat = beatTextFromCase(caseItem);
  const r = String(raw || '').toLowerCase();

  switch (r) {
    case 'no_recruiting_signal':
      if (isBeatQuoteOnly(beat)) return 'BEAT_QUOTE_ONLY';
      if (isBeatAmbiguous(beat)) return 'BEAT_AMBIGUOUS';
      return 'NO_RECRUITING_SIGNAL';
    case 'strategy_data_missing':
      return 'STRATEGY_DATA_MISSING';
    case 'missing_situation':
      return 'MISSING_SITUATION';
    case 'needs_resolution':
    case 'identity_not_confirmed':
    case 'identity_unconfirmed':
    case 'no_identifiable_player':
    case 'single_name_only':
      return 'IDENTITY_INCOMPLETE';
    case 'char_limit':
      return 'CHAR_LIMIT_FAIL';
    case 'template_overlap':
    case '3gram_overlap':
      return '3GRAM_OVERLAP_FAIL';
    case 'copy_failed':
      return 'COPY_FAILED';
    case 'quality_gate':
      return 'QUALITY_GATE';
    case 'hub_not_provisioned':
      return 'HUB_NOT_PROVISIONED';
    default:
      break;
  }

  if (handoff.isJunkBeatText(beat)) return 'BEAT_QUOTE_ONLY';
  if (isBeatQuoteOnly(beat)) return 'BEAT_QUOTE_ONLY';
  if (isBeatAmbiguous(beat)) return 'BEAT_AMBIGUOUS';
  if (!hasPlayerName(caseItem)) return 'BEAT_NO_PLAYER';
  if (!hasEvent(beat)) return 'BEAT_NO_EVENT';
  if (r) return 'UNKNOWN';
  return 'NO_RECRUITING_SIGNAL';
}

function deriveSecondaryCodes(caseItem, primary, ctx) {
  const codes = [];
  if (primary === 'IDENTITY_INCOMPLETE' && hubNotProvisioned(caseItem, ctx)) {
    codes.push('HUB_NOT_PROVISIONED');
  }
  if (primary === 'STRATEGY_DATA_MISSING') {
    if (!hasRPM(ctx)) codes.push('NO_RPM_DATA');
    if (!hasVisit(ctx)) codes.push('NO_VISIT_DATA');
    if (!hasComp(ctx)) codes.push('NO_COMP_DATA');
  }
  if (dataInconsistent(caseItem, ctx)) {
    codes.push('DATA_INCONSISTENT');
  }
  return [...new Set(codes.filter((c) => c !== primary))];
}

function detectGaps(caseItem, ctx) {
  const gaps = [];
  if (!hasPlayerName(caseItem, ctx)) gaps.push('no_player_name');
  if (!hasClassYearInBeat(caseItem, ctx)) gaps.push('no_class_year');
  if (!hasPosition(ctx, caseItem)) gaps.push('no_position');
  if (!hasRPM(ctx)) gaps.push('no_rpm');
  if (!hasVisit(ctx)) gaps.push('no_visit');
  if (!hasComp(ctx)) gaps.push('no_comp');
  if (!hasDepth(ctx)) gaps.push('no_depth');
  if (hubNotProvisioned(caseItem, ctx)) gaps.push('hub_not_provisioned');
  if (!hasOn3Link(beatTextFromCase(caseItem))) gaps.push('no_on3_link');
  if (!hasEvent(beatTextFromCase(caseItem))) gaps.push('no_event');
  return gaps;
}

function isSalvageable(primary, secondary, caseItem, ctx) {
  const beat = beatTextFromCase(caseItem);

  if (handoff.isJunkBeatText(beat)) return false;

  if (primary === 'BEAT_QUOTE_ONLY' && !hasOn3Link(beat)) return false;
  if (primary === 'BEAT_NO_PLAYER' && !hasOn3Link(beat) && !ctx.playerSlug) return false;
  if (primary === 'BEAT_AMBIGUOUS') return false;
  if (primary === 'BEAT_NO_EVENT' && !hasOn3Link(beat)) return false;
  if (primary === 'UNKNOWN') return false;

  if (primary === 'STRATEGY_DATA_MISSING') return !!(ctx.playerSlug || ctx.playerName);
  if (primary === 'IDENTITY_INCOMPLETE' && hasOn3Link(beat)) return true;
  if (primary === 'MISSING_SITUATION' && (ctx.playerSlug || hasOn3Link(beat))) return true;
  if (KNOWN_SALVAGEABLE.has(primary)) return true;

  if (secondary.includes('HUB_NOT_PROVISIONED') && hasOn3Link(beat) && ctx.playerName) return true;

  return false;
}

function buildDiagnosis(caseItem) {
  const ctx = caseContext(caseItem);
  const raw = rawSkipReason(caseItem);
  const beat = beatTextFromCase(caseItem);
  const primaryCode = mapRawReasonToSkipCode(raw, caseItem);
  const secondaryCodes = deriveSecondaryCodes(caseItem, primaryCode, ctx);
  const gaps = detectGaps(caseItem, ctx);
  const beatKind = classifyBeatKind(beat);
  const salvageable = isSalvageable(primaryCode, secondaryCodes, caseItem, ctx);

  return {
    primaryCode,
    secondaryCodes,
    salvageable,
    gaps,
    beatKind,
    classifiedAt: new Date().toISOString(),
    skipReasonRaw: raw || null
  };
}

function classifyCase(caseItem) {
  return buildDiagnosis(caseItem);
}

function classifyAndPersist(caseItem) {
  if (!caseItem?.id) return buildDiagnosis(caseItem);
  const diagnosis = buildDiagnosis(caseItem);
  store.updateCase(caseItem.id, {
    diagnosis,
    skipReasonRaw: diagnosis.skipReasonRaw || caseItem.skipReason,
    finalSkipCode: caseItem.status === 'failed_final' ? diagnosis.primaryCode : caseItem.finalSkipCode || null
  });
  return diagnosis;
}

function markFailedFinal(caseItem, diagnosis = null) {
  if (!caseItem?.id) return null;
  const dx = diagnosis || buildDiagnosis(caseItem);
  const patch = {
    status: 'failed_final',
    finalSkipCode: dx.primaryCode,
    diagnosis: { ...dx, salvageable: false }
  };
  store.updateCase(caseItem.id, patch);
  store.appendLog(caseItem.id, {
    phase: 'failed_final',
    primaryCode: dx.primaryCode,
    gaps: dx.gaps,
    beatKind: dx.beatKind
  });
  return store.getCase(caseItem.id);
}

function shouldStopInvestigation(caseItem) {
  return caseItem?.status === 'failed_final';
}

module.exports = {
  SKIP_CODES,
  classifyCase,
  classifyAndPersist,
  markFailedFinal,
  shouldStopInvestigation,
  buildDiagnosis,
  mapRawReasonToSkipCode,
  isSalvageable,
  classifyBeatKind,
  caseContext,
  hasOn3Link,
  isBeatQuoteOnly,
  beatTextFromCase
};

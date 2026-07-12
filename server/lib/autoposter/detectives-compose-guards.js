/**
 * Detectives compose guards — block promo filler; require beat-anchored insider copy.
 */
const quality = require('./quality-checks');

const PROMO_FILLER_PATTERNS = [
  /\bfull rpm,\s*visit intel,\s*and predictions on futurecast\b/i,
  /\bfull rpm percentages updated on futurecast\b/i,
  /\bfull intel on futurecast\b/i,
  /\bplayer profile and visit log on futurecast\b/i,
  /\bov timing and prediction shift live on futurecast\b/i,
  /\bboard analysis and futurecast breakdown rebuilt\b/i,
  /\bgatorvault dig-deeper\b/i
];

const UF_POSITION_TOKENS = new Set([
  'tracking',
  'committed',
  'leading',
  'in the mix',
  'hosting ov',
  'offered',
  'trending up',
  'staff priority'
]);

function isPromoFillerText(text) {
  const t = String(text || '').trim();
  if (!t) return true;
  return PROMO_FILLER_PATTERNS.some((re) => re.test(t));
}

function beatSnippet(beatText, max = 120) {
  const snippet = String(beatText || '').replace(/\s+/g, ' ').trim();
  if (snippet.length < 20) return '';
  return snippet.slice(0, max) + (snippet.length > max ? '…' : '');
}

function contextFromBeat(beatText) {
  const t = String(beatText || '');
  if (/friday night lights|\bfnl\b/i.test(t) && /swamp|gainesville/i.test(t)) {
    return 'UF beat intel — campus visit window at The Swamp for this Florida target.';
  }
  if (/unofficial visit|\buv\b|on campus|in the swamp|in gainesville/i.test(t)) {
    return 'UF beat intel — Florida hosted this prospect on campus.';
  }
  if (/official visit|\bov\b/i.test(t) && !/unofficial/i.test(t)) {
    return 'UF beat intel — official visit window active for this Florida target.';
  }
  if (/offer(?:ed|s)?/i.test(t) && /\b(?:florida|gators|\buf\b)/i.test(t)) {
    return 'UF beat intel — Florida extended an offer in this recruitment.';
  }
  if (/commit|pledge|flip/i.test(t) && /\b(?:florida|gators|\buf\b)/i.test(t)) {
    return 'UF beat intel — commit trajectory signal on the Florida board.';
  }
  if (t.length >= 30) {
    return 'UF beat intel — verified signal from trusted Florida recruiting reporting.';
  }
  return '';
}

function boardContextLine(pack) {
  const pos = String(pack?.ufPosition || '').trim().toLowerCase();
  if (!pos || UF_POSITION_TOKENS.has(pos)) return '';
  if (pos === 'hosting ov') return 'Florida is hosting an official visit window for this target.';
  if (pos === 'staff priority') return 'Staff has this prospect on the short list behind the scenes.';
  if (pos === 'leading') return 'Florida holds a favorable position in this recruitment.';
  if (pos === 'in the mix') return 'Florida remains firmly in the mix for this target.';
  if (pos === 'trending up') return 'Momentum is building toward Florida in this recruitment.';
  if (pos === 'offered') return 'Florida has an offer on the table in this recruitment.';
  return '';
}

function insiderFromBeat(beatText, writerName) {
  const snippet = beatSnippet(beatText);
  if (snippet.length >= 40) {
    const writer = writerName ? `${writerName}: ` : 'Beat read: ';
    return `${writer}${snippet}`;
  }
  return '';
}

function isPublishableDetectivesCandidate(candidate, hints = {}) {
  const text = String(candidate?.text || '').trim();
  const beatText = String(hints.beatText || candidate?.validationMeta?.beatText || '').trim();
  const path = String(candidate?.validationMeta?.detectivesPath || '');

  if (!text) return { ok: false, reason: 'empty_text' };
  if (isPromoFillerText(text)) return { ok: false, reason: 'promo_filler' };

  if (/^guarantee_/.test(path)) {
    return { ok: false, reason: 'guarantee_template_blocked' };
  }

  const blocks = candidate?.templateBlocks || {};
  const context = String(blocks.context || '').trim().toLowerCase();
  if (UF_POSITION_TOKENS.has(context)) {
    return { ok: false, reason: 'raw_uf_position_context' };
  }

  if (beatText.length >= 20) {
    const beatLower = beatText.toLowerCase();
    const textLower = text.toLowerCase();
    const beatTokens = beatLower.split(/\s+/).filter((w) => w.length > 4);
    const overlap = beatTokens.filter((w) => textLower.includes(w)).length;
    const pathAllowsResearch = /^(beat_driven|elite_caption)$/.test(path);
    if (!pathAllowsResearch && overlap < 1 && !/beat read:/i.test(text)) {
      return { ok: false, reason: 'missing_beat_anchor' };
    }
  }

  const qc = quality.runQualityChecks({
    text,
    beatText,
    blocks,
    requireContext: true
  });
  if (!qc.ok) return { ok: false, reason: 'quality_gate', errors: qc.errors };

  return { ok: true };
}

module.exports = {
  PROMO_FILLER_PATTERNS,
  UF_POSITION_TOKENS,
  isPromoFillerText,
  beatSnippet,
  contextFromBeat,
  boardContextLine,
  insiderFromBeat,
  isPublishableDetectivesCandidate
};

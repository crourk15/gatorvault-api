/**
 * Autoposter Quality Checks
 */
const insiderPrompt = require('../x-autoposter-insider-prompt');
const insiderTone = require('./insider-tone');

const OVERLAP_MAX = parseFloat(process.env.X_AUTOPOST_QUOTE_OVERLAP_MAX || '0.2', 10);
const MIN_REWRITE_WORDS = parseInt(process.env.X_AUTOPOST_MIN_REWRITE_WORDS || '40', 10);

const CONTEXT_KEYWORDS = ['visit', 'staff', 'coach', 'timeline', 'group', 'traction', 'momentum', 'movement', 'confidence', 'prediction', 'futurecast'];

function quoteRewriter() {
  return require('../x-autoposter-recruiting-quote-rewriter');
}

function similarityScore(source, rewrite) {
  const srcTokens = new Set(
    String(source || '')
      .toLowerCase()
      .replace(/[^\w\s']/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
  );
  const rwTokens = String(rewrite || '')
    .toLowerCase()
    .replace(/[^\w\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  let overlap = 0;
  rwTokens.forEach((t) => {
    if (srcTokens.has(t)) overlap += 1;
  });
  return overlap / Math.max(rwTokens.length, 1);
}

function isInsiderTone(text) {
  return insiderTone.validateInsiderTone(text, { minWords: 0 }).errors.indexOf('forbidden_tone') === -1;
}

function hasContext(text) {
  const lower = String(text || '').toLowerCase();
  return CONTEXT_KEYWORDS.some((k) => lower.includes(k));
}

function validateRewrite(source, rewrite, options = {}) {
  const maxOverlap =
    options.eventType === 'prediction_change' || options.eventType === 'prediction'
      ? Math.max(OVERLAP_MAX, 0.35)
      : OVERLAP_MAX;
  const sim = similarityScore(source, rewrite);
  const lengthOk = String(rewrite || '').trim().split(/\s+/).filter(Boolean).length >= MIN_REWRITE_WORDS;
  const toneOk = isInsiderTone(rewrite);
  const contextOk = hasContext(rewrite);
  return {
    ok: sim < maxOverlap && lengthOk && toneOk && contextOk,
    similarity: sim,
    lengthOk,
    toneOk,
    contextOk
  };
}

function runQualityChecks({ text, beatText, blocks = null, requireContext = true } = {}) {
  const errors = [];
  const body = String(text || '').trim();
  const beat = String(beatText || '').trim();
  const qr = quoteRewriter();

  if (!body) errors.push('empty_rewrite');

  const tone = insiderTone.validateInsiderTone(body, { minWords: MIN_REWRITE_WORDS });
  if (!tone.ok) errors.push(...tone.errors);

  if (beat && qr.exceedsOverlap(body, beat)) errors.push('similarity_exceeded');

  if (blocks) {
    const templateCheck = insiderPrompt.validateInsiderBlocks(
      { contextLine: blocks.context || blocks.contextLine, insiderLine: blocks.insider || blocks.insiderLine },
      beat
    );
    if (!templateCheck.ok) errors.push(...templateCheck.errors);
  }

  if (requireContext && !hasContext(body)) errors.push('missing_context');

  if (requireContext && beat) {
    const classified = require('../x-autoposter-template').classifyBeatSentences(beat);
    const beatStructure = [...(classified.context || []), ...(classified.insider || [])].join(' ');
    if (beatStructure && qr.sourceOverlapRatio(body, beatStructure) > OVERLAP_MAX) {
      errors.push('beat_structure_copy');
    }
  }

  if (insiderTone.isGenericFluff(body)) errors.push('generic_fluff');
  if (/#[A-Za-z0-9_]+/.test(body)) errors.push('has_hashtag');
  if (/[\u{1F300}-\u{1FAFF}]/u.test(body)) errors.push('has_emoji');

  return {
    ok: errors.length === 0,
    errors,
    overlapRatio: beat ? qr.sourceOverlapRatio(body, beat) : similarityScore(beat, body),
    wordCount: tone.wordCount,
    overlapMax: OVERLAP_MAX,
    minWords: MIN_REWRITE_WORDS
  };
}

module.exports = {
  OVERLAP_MAX,
  MIN_REWRITE_WORDS,
  similarityScore,
  isInsiderTone,
  hasContext,
  validateRewrite,
  runQualityChecks
};

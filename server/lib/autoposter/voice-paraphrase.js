/**
 * Paraphrase beat/intel text — PR-5 strategy engine (Extract → Compose → Score → Guard → Trace).
 */
const template = require('../x-autoposter-template');
const quoteRewriter = require('../x-autoposter-recruiting-quote-rewriter');
const { buildStrategyEngineOutput } = require('./strategy/strategy-engine');
const { buildIntelSentence } = require('./strategy/strategy-intel');

const strategyPackCache = new WeakMap();

function getStrategyPack(signal) {
  if (strategyPackCache.has(signal)) return strategyPackCache.get(signal);
  const out = buildStrategyEngineOutput(signal);
  strategyPackCache.set(signal, out);
  return out;
}

function stripUrls(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstFactualSentence(text, maxLen = 200) {
  const sentences = template.extractSentences(stripUrls(text));
  for (const s of sentences) {
    const clean = template.sanitizeCopyLine(s, maxLen, { sport: 'football' });
    if (clean && clean.length >= 24 && !template.HEADLINE_ONLY_RE.test(clean)) return clean;
  }
  const flat = stripUrls(text).slice(0, maxLen).trim();
  return flat.length >= 20 ? flat : null;
}

function buildIntelLine(signal) {
  return buildIntelSentence(signal);
}

function paraphraseIntel(signal, { sourceLabel = 'Beat writer' } = {}) {
  const raw = signal?.event?.description || signal?.beatText || '';
  if (!raw) return null;

  if (quoteRewriter.isRewriterEnabled()) {
    const rewritten = quoteRewriter.rewriteBeatUpdate({
      beatText: raw,
      sourceLabel: signal?.event?.source || sourceLabel,
      postKind: signal?.type === 'recruiting' ? 'recruiting' : 'news',
      sport: 'football'
    });
    if (rewritten?.ok && rewritten.contextLine) {
      const line = quoteRewriter.sanitizeRewrittenLine(rewritten.contextLine, raw, 200);
      if (line && !quoteRewriter.exceedsOverlap(line, raw)) return line.endsWith('.') ? line : `${line}.`;
    }
  }

  const fallback = firstFactualSentence(raw, 200);
  if (!fallback) return null;
  return fallback.endsWith('.') ? fallback : `${fallback}.`;
}

function nonRecruitingContext(signal) {
  const type = signal?.type || 'recruiting';
  const beat = String(signal?.beatText || signal?.event?.description || '').toLowerCase();

  if (type === 'portal') {
    return 'Trenches and snap distribution remain the highest-variance piece entering camp.';
  }
  if (type === 'roster') {
    const pos = signal?.player?.pos || 'the position group';
    return `Two-deep movement at ${pos} is still fluid for Florida.`;
  }
  if (type === 'opponent') {
    if (/\bquick|tempo|pass\b/.test(beat)) {
      return "Florida's quick-game packages should be live early in this matchup.";
    }
    return 'Florida can stress this front with tempo and spacing in the early install window.';
  }
  return null;
}

class StrategyDataMissing extends Error {
  constructor() {
    super('strategy_data_missing');
    this.code = 'strategy_data_missing';
  }
}

function paraphraseUFContext(signal) {
  const pack = getStrategyPack(signal);
  if (pack?.contextLine) return pack.contextLine;

  const fallback = nonRecruitingContext(signal);
  if (fallback) return fallback;

  throw new StrategyDataMissing();
}

function buildStrategyLine(signal) {
  const pack = getStrategyPack(signal);
  if (!pack?.strategyLine || pack.confidence === 'zero') throw new StrategyDataMissing();
  return pack.strategyLine;
}

module.exports = {
  StrategyDataMissing,
  paraphraseIntel,
  paraphraseUFContext,
  buildStrategyLine,
  buildStrategyPack: getStrategyPack,
  buildIntelLine,
  firstFactualSentence
};

/** PR-5 — confidence scoring for strategy output. */

const { MIN_STRATEGY_CHARS } = require('./strategy-types');
const { containsBannedPhrase } = require('./strategy-provenance');
const { BANNED_STRATEGY_PHRASES } = require('./strategy-types');
const { beatTokens } = require('./strategy-context');

function scoreStrategy(strategyLine, chosenSignals, allSignals, contextLine, beatText = '') {
  if (!strategyLine || strategyLine.length < MIN_STRATEGY_CHARS) return 'zero';
  if (containsBannedPhrase(strategyLine, BANNED_STRATEGY_PHRASES)) return 'zero';
  if (/— the\.|\bthe\.\s*$/i.test(strategyLine)) return 'zero';

  const highCount = (allSignals || []).filter((s) => s.confidence === 'high').length;
  const mediumCount = (allSignals || []).filter((s) => s.confidence === 'medium').length;
  const signalTypes = new Set((chosenSignals || allSignals || []).map((s) => s.type));

  let score = 0;
  if (signalTypes.has('visit')) score += 2;
  if (signalTypes.has('board')) score += 2;
  if (signalTypes.has('staff')) score += 2;
  if (signalTypes.has('comp')) score += 1;
  if (signalTypes.has('ufAngle')) score += 1;
  if (signalTypes.has('quote')) score += 1;
  score += highCount * 2;
  score += mediumCount;

  const ctxTokens = beatTokens(beatText);
  if (contextLine && ctxTokens.length >= 2) {
    const ctxLower = contextLine.toLowerCase();
    const ctxHits = ctxTokens.filter((t) => ctxLower.includes(t.toLowerCase()));
    if (ctxHits.length >= 2) score += 2;
  }

  if (score >= 8) return 'high';
  if (score >= 4) return 'medium';
  if (score >= 2 && strategyLine.length >= MIN_STRATEGY_CHARS) return 'low';
  return 'zero';
}

module.exports = {
  scoreStrategy
};

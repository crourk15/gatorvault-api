/** PR-5 — Extract → Compose → Score → Guard → Trace orchestrator. */

const { extractSignalsFromBeat } = require('./strategy-extract');
const { extractSignalsFromMetrics, mergeSignals } = require('./strategy-metrics');
const { composeStrategy } = require('./strategy-compose');
const { buildContextLine } = require('./strategy-context');
const { scoreStrategy } = require('./strategy-score');
const { guardCompression, isTruncatedBadly } = require('./strategy-guard');
const { buildTrace } = require('./strategy-trace');
const { validateSignalTokens, containsBannedPhrase } = require('./strategy-provenance');
const { BANNED_STRATEGY_PHRASES } = require('./strategy-types');

class StrategyEngineError extends Error {
  constructor(code, message, trace = null) {
    super(message);
    this.name = 'StrategyEngineError';
    this.code = code;
    this.trace = trace;
  }
}

function resolveBeatText(signal) {
  return String(
    signal?.beatText ||
      signal?.event?.description ||
      signal?.event?.text ||
      signal?.description ||
      ''
  ).trim();
}

function resolveIdentity(signal) {
  const p = signal?.player || {};
  return {
    playerName: p.name || p.playerName || signal?.playerName || '',
    pos: p.pos || p.position || signal?.pos || 'prospect',
    classYear: p.classYear || p.year || signal?.classYear || ''
  };
}

function buildStrategyEngineOutput(signal, opts = {}) {
  const beatText = resolveBeatText(signal);
  const identity = resolveIdentity(signal);
  const metrics = signal?.metrics || {};
  const ufContext = signal?.ufContext || signal?.uf || {};
  const scouting = signal?.scouting || {};

  if (!beatText || beatText.length < 24) {
    const trace = buildTrace({
      beatText,
      allSignals: [],
      chosenSignals: [],
      templateId: null,
      strategyLine: null,
      contextLine: null,
      confidence: 'zero',
      provenance: { ok: false }
    });
    return {
      strategyLine: null,
      contextLine: null,
      confidence: 'zero',
      trace,
      templateId: null,
      error: 'beat_missing'
    };
  }

  const beatSignals = extractSignalsFromBeat(beatText, identity);
  const metricSignals = extractSignalsFromMetrics(metrics, ufContext);
  let allSignals = mergeSignals(beatSignals, metricSignals);

  const provenance = validateSignalTokens(allSignals, { beatText, metrics, scouting, ufContext });
  if (!provenance.ok && !opts.relaxProvenance) {
    allSignals = allSignals.filter((sig) => {
      return (sig.tokens || []).every((token) =>
        provenance.haystack.includes(String(token).toLowerCase().slice(0, 6))
      );
    });
  }

  const composed = composeStrategy(allSignals, identity);
  let strategyLine = composed.strategyLine;
  let contextLine = buildContextLine(allSignals, identity, ufContext, beatText);

  if (strategyLine) {
    strategyLine = guardCompression(strategyLine);
  }

  if (containsBannedPhrase(strategyLine, BANNED_STRATEGY_PHRASES)) {
    strategyLine = null;
  }
  if (containsBannedPhrase(contextLine, BANNED_STRATEGY_PHRASES)) {
    contextLine = null;
  }

  if (isTruncatedBadly(strategyLine)) {
    strategyLine = null;
  }

  const confidence = scoreStrategy(
    strategyLine,
    composed.chosenSignals,
    allSignals,
    contextLine,
    beatText
  );

  const trace = buildTrace({
    beatText,
    allSignals,
    chosenSignals: composed.chosenSignals,
    templateId: composed.templateId,
    strategyLine,
    contextLine,
    confidence,
    provenance
  });

  return {
    strategyLine,
    contextLine,
    confidence,
    trace,
    templateId: composed.templateId
  };
}

module.exports = {
  StrategyEngineError,
  buildStrategyEngineOutput,
  resolveBeatText,
  resolveIdentity
};

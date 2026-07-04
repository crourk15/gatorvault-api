/** PR-5 — metrics and UF context as signals (not gates). */

function pushMetricSignal(signals, seen, payload) {
  const key = `${payload.type}:${payload.tokens.join('|')}`;
  if (seen.has(key)) return;
  seen.add(key);
  signals.push(payload);
}

function extractSignalsFromMetrics(metrics = {}, ufContext = {}) {
  const signals = [];
  const seen = new Set();

  if (metrics.visitDate) {
    pushMetricSignal(signals, seen, {
      type: 'visit',
      tokens: [String(metrics.visitDate)],
      source: 'metrics',
      confidence: 'medium'
    });
  }

  if (metrics.rpm != null && Number.isFinite(Number(metrics.rpm))) {
    pushMetricSignal(signals, seen, {
      type: 'cycle',
      tokens: [`${metrics.rpm}% RPM`],
      source: 'metrics',
      confidence: 'medium'
    });
  }

  if (metrics.compSchools?.length) {
    pushMetricSignal(signals, seen, {
      type: 'comp',
      tokens: metrics.compSchools.slice(0, 3).map(String),
      source: 'metrics',
      confidence: 'medium'
    });
  }

  if (metrics.depthChartNote) {
    pushMetricSignal(signals, seen, {
      type: 'trait',
      tokens: [String(metrics.depthChartNote).slice(0, 48)],
      source: 'metrics',
      confidence: 'low'
    });
  }

  if (metrics.schemeNote) {
    pushMetricSignal(signals, seen, {
      type: 'trait',
      tokens: [String(metrics.schemeNote).slice(0, 48)],
      source: 'metrics',
      confidence: 'low'
    });
  }

  if (ufContext.posNeed) {
    pushMetricSignal(signals, seen, {
      type: 'trait',
      tokens: [String(ufContext.posNeed).slice(0, 40)],
      source: 'ufContext',
      confidence: 'low'
    });
  }

  if (ufContext.boardTier) {
    pushMetricSignal(signals, seen, {
      type: 'board',
      tokens: [String(ufContext.boardTier).slice(0, 40)],
      source: 'ufContext',
      confidence: 'low'
    });
  }

  if (ufContext.cyclePlan) {
    pushMetricSignal(signals, seen, {
      type: 'cycle',
      tokens: [String(ufContext.cyclePlan).slice(0, 40)],
      source: 'ufContext',
      confidence: 'low'
    });
  }

  return signals;
}

function mergeSignals(beatSignals, metricSignals) {
  const merged = [...(beatSignals || [])];
  const seen = new Set(merged.map((s) => `${s.type}:${s.tokens.join('|')}`));

  for (const sig of metricSignals || []) {
    const key = `${sig.type}:${sig.tokens.join('|')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(sig);
  }

  return merged;
}

function bestSignal(signals, type) {
  const rank = { high: 3, medium: 2, low: 1 };
  const matches = (signals || []).filter((s) => s.type === type);
  if (!matches.length) return null;
  return matches.sort((a, b) => (rank[b.confidence] || 0) - (rank[a.confidence] || 0))[0];
}

function hasSignalType(signals, type) {
  return (signals || []).some((s) => s.type === type);
}

module.exports = {
  extractSignalsFromMetrics,
  mergeSignals,
  bestSignal,
  hasSignalType
};

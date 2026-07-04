/** PR-5 — trace object for Detectives + QA. */

function buildTrace({
  beatText,
  allSignals,
  chosenSignals,
  templateId,
  strategyLine,
  contextLine,
  confidence,
  provenance
}) {
  return {
    engine: 'v2',
    templateId: templateId || null,
    confidence: confidence || 'zero',
    strategyLine: strategyLine || null,
    contextLine: contextLine || null,
    signalCount: (allSignals || []).length,
    chosenTypes: [...new Set((chosenSignals || []).map((s) => s.type))],
    signals: (allSignals || []).map((s) => ({
      type: s.type,
      tokens: s.tokens,
      source: s.source,
      confidence: s.confidence
    })),
    beatLength: String(beatText || '').length,
    provenanceOk: provenance?.ok !== false,
    invalidTokens: provenance?.invalid || []
  };
}

module.exports = {
  buildTrace
};

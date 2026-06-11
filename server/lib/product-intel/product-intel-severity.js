/**
 * Product Intelligence — Severity Layer (Section 1 Layer 3 + Section 3 Scoring Model).
 *
 * severityScore = (impact * 0.6) + (frequency * 0.3) + (confidence * 0.1)
 *
 * Bands: Critical 90–100 | High 70–89 | Medium 40–69 | Low 0–39
 */
const classifier = require('./product-intel-classifier');

function scoreToBand(score) {
  const n = Math.max(0, Math.min(100, Math.round(score)));
  if (n >= 90) return 'critical';
  if (n >= 70) return 'high';
  if (n >= 40) return 'medium';
  return 'low';
}

function bandLabel(band) {
  const rules = classifier.loadRules();
  return rules.severityBands?.[band]?.label || band;
}

/**
 * @param {object} opts
 * @param {number} opts.impact - 0–100 how bad (user impact)
 * @param {number} opts.frequency - 0–100 how often seen (from signal history)
 * @param {number} opts.confidence - 0–100 detection certainty
 */
function computeSeverityScore({ impact, frequency, confidence }) {
  const i = Math.max(0, Math.min(100, Number(impact) || 0));
  const f = Math.max(0, Math.min(100, Number(frequency) || 0));
  const c = Math.max(0, Math.min(100, Number(confidence) || 0));
  const score = Math.round(i * 0.6 + f * 0.3 + c * 0.1);
  const band = scoreToBand(score);
  return {
    severityScore: score,
    severity: band,
    severityLabel: bandLabel(band),
    components: { impact: i, frequency: f, confidence: c }
  };
}

function frequencyFromHistory(historyEntry, runCount = 1) {
  if (!historyEntry) return Math.min(30, runCount * 10);
  const count = historyEntry.count || 1;
  const recentRuns = historyEntry.recentRuns || 1;
  const ratio = Math.min(1, count / Math.max(1, recentRuns));
  return Math.round(Math.min(100, 40 + ratio * 60));
}

function inferImpactFromClassification(classification, check) {
  const cls = classifier.classifyCheck(check || { id: classification });
  const base = cls.defaultImpact ?? 60;

  const id = String(check?.id || '');
  if (/cross-page|contamination|feed-dedup|autoposter-dedup/.test(id)) return Math.max(base, 90);
  if (/layout-overflow|panel-clipping|missing-content|404|broken/.test(id)) return Math.max(base, 80);
  if (/stale|latency|cache/.test(id)) return Math.max(base, 65);
  if (check?.module === 'content') return Math.min(base, 45);
  return base;
}

function inferConfidenceFromCheck(check) {
  if (check?.details?.length) return Math.min(100, 75 + Math.min(check.details.length * 3, 20));
  if (check?.error) return 85;
  return 70;
}

function scoreIssue(check, historyEntry, runCount) {
  const cls = classifier.classifyCheck(check);
  const impact = inferImpactFromClassification(cls.classification, check);
  const frequency = frequencyFromHistory(historyEntry, runCount);
  const confidence = cls.defaultConfidence ?? inferConfidenceFromCheck(check);
  const scored = computeSeverityScore({ impact, frequency, confidence });
  return {
    ...cls,
    ...scored,
    impact: impact >= 70 ? 'user-facing' : impact >= 45 ? 'internal' : 'cosmetic',
    eta: scored.severity === 'critical' || scored.severity === 'high' ? 'short' : scored.severity === 'medium' ? 'medium' : 'long'
  };
}

function scoreSignal(signal, historyEntry, runCount) {
  const cls = classifier.classifySignal(signal);
  const impact = signal.impact ?? cls.defaultImpact ?? 60;
  const frequency = frequencyFromHistory(historyEntry, runCount);
  const confidence = signal.confidence ?? cls.defaultConfidence ?? 80;
  const scored = computeSeverityScore({ impact, frequency, confidence });
  return {
    ...cls,
    ...scored,
    impact: impact >= 70 ? 'user-facing' : 'internal',
    eta: scored.severity === 'critical' || scored.severity === 'high' ? 'short' : 'medium'
  };
}

module.exports = {
  computeSeverityScore,
  scoreToBand,
  bandLabel,
  frequencyFromHistory,
  scoreIssue,
  scoreSignal
};

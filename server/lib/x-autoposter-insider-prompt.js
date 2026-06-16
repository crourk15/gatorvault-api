/**
 * Elite Insider Template — enforced rewrite spec for X AutoPoster + GM2.
 *
 * Line 1 (identity): class · stars · pos · Name · school/rank
 * Line 2 (lead insight): what UF staff actually feels / priority signal
 * Line 3 (context): visit, relationships, momentum, competition
 * Line 4 (projection): what's next, UF probability, movement, timeline
 *
 * Rules:
 * - Never copy beat writer text (>20% token overlap with source)
 * - Must include player identity fields when available
 * - Must enrich short/generic beat posts with intel + FutureCast metrics
 * - Regenerate when similarity to source exceeds threshold
 */
const template = require('./x-autoposter-template');
const quoteRewriter = require('./x-autoposter-recruiting-quote-rewriter');

const MIN_CONTEXT_LEN = parseInt(process.env.X_AUTOPOST_MIN_CONTEXT_LEN || '28', 10);
const MIN_INSIDER_LEN = parseInt(process.env.X_AUTOPOST_MIN_INSIDER_LEN || '24', 10);
const MIN_PROJECTION_LEN = parseInt(process.env.X_AUTOPOST_MIN_PROJECTION_LEN || '24', 10);

const GENERIC_INSIDER_RES = [
  /^florida is actively tracking/i,
  /^more clarity expected soon/i,
  /^per .+ report\.?$/i,
  /^sources say\b/i,
  /^stay tuned/i
];

function isGenericInsiderLine(line) {
  const t = template.stripEmojisHashtags(line || '').trim();
  if (!t || t.length < MIN_INSIDER_LEN) return true;
  return GENERIC_INSIDER_RES.some((re) => re.test(t));
}

function formatVisitType(intel = {}, situation = null) {
  const et = String(intel.eventType || '').toLowerCase();
  const sit = String(situation || '').toLowerCase();
  if (et.includes('official') || /official visit|\bov\b/.test(String(intel.detail || ''))) return 'official visit';
  if (et.includes('unofficial') || /\buv\b/.test(String(intel.detail || ''))) return 'unofficial visit';
  if (et.includes('visit_cancel')) return 'visit change';
  if (sit === 'portal') return 'portal window';
  if (sit === 'offer') return 'offer evaluation';
  if (sit === 'commitment') return 'commitment track';
  return sit || 'recruiting window';
}

function formatMetricsPhrase(metrics = {}) {
  const parts = [];
  if (metrics.ufProbability != null && Number.isFinite(Number(metrics.ufProbability))) {
    const pct = Number(metrics.ufProbability);
    const display = pct <= 1 ? Math.round(pct * 100) : Math.round(pct);
    parts.push(`UF at ${display}%`);
  }
  if (metrics.movementDelta != null && Number(metrics.movementDelta) !== 0) {
    const d = Number(metrics.movementDelta);
    parts.push(d > 0 ? `+${d} pts this week` : `${d} pts this week`);
  }
  if (metrics.fitScore != null && Number(metrics.fitScore) > 0) {
    parts.push(`fit ${Math.round(Number(metrics.fitScore))}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function buildLeadInsightLine({ signal, research, metrics, sourceLabel }) {
  const staff = research?.ufPosition || metrics?.ufStatus;
  if (staff === 'staff priority') {
    return 'UF staff has this one pinned near the top of the board.';
  }
  if (staff === 'leading') {
    return 'Florida sits in the lead group — staff confidence is rising.';
  }
  if (signal?.ufStanding === 'priority') {
    return 'Sumrall’s room is pushing hard — this one is a staff priority.';
  }
  if (signal?.momentum === 'heating') {
    return 'Momentum is tilting Florida’s way behind the scenes.';
  }
  if (metrics?.ufProbability != null) {
    const phrase = formatMetricsPhrase(metrics);
    if (phrase) return `Insider read: ${phrase} with real staff interest.`;
  }
  if (sourceLabel) {
    return `Verified beat signal — UF is actively in the mix per ${sourceLabel}.`;
  }
  return 'Florida’s staff is engaged — this one is on the priority radar.';
}

function buildContextLine({ signal, research, metrics, intel, visitType, sourceLabel }) {
  const competition = signal?.competition?.length
    ? signal.competition.slice(0, 2).join(' and ')
    : research?.competition || null;
  const visit = signal?.visitSchedule || research?.visitSchedule || intel?.visitStart || null;
  const bits = [];

  if (visitType === 'official visit' && visit) {
    bits.push(`Official visit window ${visit} — campus access matters here.`);
  } else if (visitType === 'official visit') {
    bits.push('Official visit timing should sharpen where UF stands.');
  } else if (visitType === 'visit change') {
    bits.push('Visit plan shifted — Florida will recalibrate timing and staff touches.');
  } else if (visitType === 'portal window') {
    bits.push('Portal movement puts Florida in the evaluation mix.');
  } else if (signal?.playerIntent) {
    bits.push(`${signal.playerIntent.charAt(0).toUpperCase()}${signal.playerIntent.slice(1)}.`);
  }

  if (competition) {
    bits.push(`Competition: ${competition}.`);
  }
  if (research?.staffInvolved?.length) {
    bits.push(`Staff in the loop: ${research.staffInvolved.slice(0, 2).join(', ')}.`);
  }
  if (!bits.length && sourceLabel) {
    bits.push(`Fresh ${visitType} intel surfaced via ${sourceLabel}.`);
  }
  return bits.join(' ').trim() || null;
}

function buildProjectionLine({ signal, research, metrics, intel, visitType }) {
  const metricPhrase = formatMetricsPhrase(metrics);
  const timeline =
    signal?.returnVisitPotential || research?.timeline || intel?.visitEnd || null;

  if (metricPhrase && timeline) {
    return `Watch ${timeline}: ${metricPhrase} — next staff touch should clarify the picture.`;
  }
  if (metricPhrase) {
    return `Projection: ${metricPhrase} — decision window tightening.`;
  }
  if (visitType === 'official visit') {
    return 'OV fallout should define whether Florida jumps into the lead pack.';
  }
  if (signal?.eventType === 'commit' || signal?.eventType === 'flip') {
    return 'Closing window — UF expects clarity within days, not weeks.';
  }
  if (research?.predictions?.length) {
    const p = research.predictions[0];
    const pct = p.confidencePct || p.ufRpmPct;
    if (pct) return `${p.analystName || 'Analysts'} see Florida at ${pct}% — watch for movement after the next touch.`;
  }
  return 'Next 72 hours: staff visits and camp buzz should move the needle.';
}

/**
 * Compose insider blocks using elite template (context = lead+context merged for 3-line tweet).
 */
function composeInsiderBlocks({ signal, research, metrics, intel, sourceLabel, situation }) {
  const visitType = formatVisitType(intel, situation);
  const lead = buildLeadInsightLine({ signal, research, metrics, sourceLabel });
  const contextExtra = buildContextLine({ signal, research, metrics, intel, visitType, sourceLabel });
  const projection = buildProjectionLine({ signal, research, metrics, intel, visitType });

  const contextLine = [lead, contextExtra].filter(Boolean).join(' ').trim();
  const insiderLine = projection;

  return {
    visitType,
    leadInsight: lead,
    contextBlock: contextExtra,
    projection: insiderLine,
    contextLine: template.sanitizeCopyLine(contextLine, 140, { eliteMode: true }),
    insiderLine: template.sanitizeCopyLine(insiderLine, 140, { eliteMode: true }),
    metrics
  };
}

function validateInsiderBlocks(blocks, beatText) {
  const errors = [];
  if (!blocks?.contextLine || blocks.contextLine.length < MIN_CONTEXT_LEN) {
    errors.push('context_too_short');
  }
  if (!blocks?.insiderLine || blocks.insiderLine.length < MIN_PROJECTION_LEN) {
    errors.push('projection_too_short');
  }
  if (isGenericInsiderLine(blocks?.insiderLine)) {
    errors.push('generic_projection');
  }
  if (beatText) {
    const combined = `${blocks.contextLine} ${blocks.insiderLine}`;
    if (quoteRewriter.exceedsOverlap(combined, beatText)) {
      errors.push('overlap_exceeded');
    }
  }
  return { ok: errors.length === 0, errors };
}

function getInsiderTemplatePolicy() {
  return {
    name: 'gm2_exact_v1',
    blocks: ['identity', 'lead_insight+context', 'projection'],
    overlapMax: quoteRewriter.OVERLAP_THRESHOLD,
    minContextLen: MIN_CONTEXT_LEN,
    minProjectionLen: MIN_PROJECTION_LEN,
    rules: [
      'Must not copy beat writer text',
      'Must include UF context and player identity',
      'Must use UF probability / movement when available',
      'Must regenerate when overlap > threshold',
      'Must reject generic tracking-only projection lines'
    ]
  };
}

module.exports = {
  MIN_CONTEXT_LEN,
  MIN_INSIDER_LEN,
  MIN_PROJECTION_LEN,
  isGenericInsiderLine,
  formatVisitType,
  formatMetricsPhrase,
  buildLeadInsightLine,
  buildContextLine,
  buildProjectionLine,
  composeInsiderBlocks,
  validateInsiderBlocks,
  getInsiderTemplatePolicy,
  GENERIC_INSIDER_RES
};

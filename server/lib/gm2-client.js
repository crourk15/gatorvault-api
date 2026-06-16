/**
 * GM2 client — deterministic insider rewrite completion for autoposter rewrite-engine.
 * Uses the canonical GM2 prompt + template composition (no external LLM required).
 */
const { GM2_REWRITE_PROMPT } = require('./autoposter/gm2-rewrite-prompt');

function formatVisitLabel(visitType) {
  const t = String(visitType || '').toLowerCase();
  if (t.includes('official')) return 'official visit';
  if (t.includes('unofficial')) return 'unofficial visit';
  return t.replace(/_/g, ' ') || 'recruiting window';
}

function buildInsiderParagraph(player = {}, context = {}, intel = {}) {
  const name = player.name || 'the prospect';
  const pos = player.position || player.pos || 'prospect';
  const year = player.classYear || '';
  const rating = player.rating ? ` (${player.rating}-rated)` : '';
  const visit = formatVisitLabel(context.visitType || intel.eventType);
  const visitDates = context.visitDates || context.visitStart || null;
  const staff = (context.staffContacts || []).filter(Boolean);
  const competition = (context.competition || []).filter(Boolean);
  const ufPct = context.ufProbability ?? player.ufProbability;
  const delta = context.movementDelta ?? player.movementDelta ?? 0;
  const timeline = context.timeline || 'summer decision';

  const lead = `UF quietly strengthened its position with ${name}, a ${year} ${pos}${rating} after a ${visit}${visitDates ? ` to Gainesville from ${visitDates}` : ' to Gainesville'}. Staff feels momentum is trending upward as ${name.split(' ')[0] || 'the prospect'} continues building relationships on campus.`;
  const ctxParts = [];
  if (staff.length) {
    ctxParts.push(`${staff.join(' and ')} ${staff.length > 1 ? 'are' : 'is'} heavily involved behind the scenes.`);
  }
  if (competition.length) {
    ctxParts.push(`Florida sits firmly in the top group alongside programs like ${competition.slice(0, 3).join(' and ')}.`);
  } else {
    ctxParts.push('Florida sits firmly in the top group behind the scenes.');
  }
  const contextBlock = ctxParts.join(' ');
  const projParts = [];
  if (ufPct != null) projParts.push(`FutureCast puts UF at ${Math.round(ufPct <= 1 ? ufPct * 100 : ufPct)}%`);
  if (delta) projParts.push(`movement is +${delta} points this cycle`);
  projParts.push(`watch the ${timeline} window for the next clarity point`);
  const projection = `With a ${timeline} expected, UF is aiming to capitalize on this visit and maintain traction through the next round of trips and conversations. ${projParts.join(' — ')}.`;

  return [lead, contextBlock, projection].join(' ');
}

function buildPredictionChangeParagraph(player = {}, context = {}, intel = {}) {
  const name = player.name || 'the prospect';
  const pos = player.position || player.pos || 'prospect';
  const year = player.classYear || '';
  const rating = player.rating ? ` (${player.rating}-rated)` : '';
  const ufPct = context.ufProbability ?? intel.confidencePct ?? null;
  const prior = context.priorConfidence ?? intel.priorConfidencePct ?? null;
  const delta = context.movementDelta ?? intel.movementDelta ?? (ufPct != null && prior != null ? ufPct - prior : 0);
  const competition = (context.competition || []).filter(Boolean);
  const timeline = context.timeline || 'summer decision';
  const first = name.split(' ')[0] || 'the prospect';
  const displayPct = ufPct != null ? Math.round(ufPct <= 1 ? ufPct * 100 : ufPct) : null;

  const lead = `Florida's traction with ${name}, a ${year} ${pos}${rating}, picked up meaningful steam after the latest FutureCast update. Behind the scenes, staff confidence is building as ${first} remains a priority target on the board.`;
  const ctxParts = [];
  if (prior != null && displayPct != null && delta !== 0) {
    ctxParts.push(`The projection shifted ${delta > 0 ? 'sharply' : 'noticeably'} — UF moved from ${Math.round(prior)}% to ${displayPct}% in the model.`);
  } else if (displayPct != null) {
    ctxParts.push(`FutureCast now slots UF at ${displayPct}% in this race.`);
  }
  if (competition.length) {
    ctxParts.push(`The Gators still share the lead cluster with programs like ${competition.slice(0, 3).join(' and ')}.`);
  } else {
    ctxParts.push('Florida remains in the lead group with real separation from the rest of the pack.');
  }
  const contextBlock = ctxParts.join(' ');
  const projection = `Next checkpoint is the ${timeline} window — watch whether staff contact and campus momentum keep pushing this one Florida's way. If the numbers hold, UF looks positioned to stay in the driver's seat through the next round of movement.`;

  return [lead, contextBlock, projection].join(' ');
}

async function complete(promptOrBundle) {
  if (promptOrBundle && typeof promptOrBundle === 'object' && promptOrBundle.player) {
    const et = String(promptOrBundle.intel?.eventType || '').toLowerCase();
    if (et === 'prediction_change' || et === 'prediction') {
      return buildPredictionChangeParagraph(
        promptOrBundle.player,
        promptOrBundle.context || {},
        promptOrBundle.intel || {}
      );
    }
    return buildInsiderParagraph(promptOrBundle.player, promptOrBundle.context || {}, promptOrBundle.intel || {});
  }
  if (typeof promptOrBundle === 'string' && promptOrBundle.includes(GM2_REWRITE_PROMPT.slice(0, 40))) {
    return buildInsiderParagraph({}, {}, { text: promptOrBundle });
  }
  return buildInsiderParagraph({}, {}, { text: String(promptOrBundle || '') });
}

module.exports = {
  complete,
  buildInsiderParagraph,
  buildPredictionChangeParagraph
};

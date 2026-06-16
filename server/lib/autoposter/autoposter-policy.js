/**
 * Autoposter policy — eligibility rules before GM2 rewrite / queue.
 */
function isEligibleIntel(intel = {}, player = null) {
  if (!player) return false;
  if (intel.ufRelevant === false) return false;
  if (intel.ufRelevant !== true) {
    const detail = String(intel.text || intel.detail || '');
    const et = String(intel.eventType || '');
    const ufSignal =
      /florida|gators|\buf\b|gainesville/i.test(detail) ||
      ['official_visit', 'unofficial_visit', 'commit', 'flip', 'portal_in', 'offer', 'prediction', 'prediction_change'].includes(et) ||
      /rivals_pm|rivals pm|prediction machine|futurecast/i.test(String(intel.source || ''));
    if (!ufSignal) return false;
  }
  if (!intel.eventType) return false;
  if (intel.isDuplicate) return false;
  if (intel.sourceType === 'rumor') return false;
  return true;
}

function assessEligibilityFromIntel(intel = {}, player = null) {
  const reasons = [];
  if (!player) reasons.push('no_player');
  if (intel.ufRelevant === false) reasons.push('not_uf_relevant');
  if (!intel.eventType) reasons.push('missing_event_type');
  if (intel.isDuplicate) reasons.push('duplicate');
  if (intel.sourceType === 'rumor') reasons.push('rumor');
  return { eligible: reasons.length === 0, reasons };
}

module.exports = {
  isEligibleIntel,
  assessEligibilityFromIntel
};

/**
 * PR-789 fact gates — banned filler phrases + completeness checks.
 */

const BANNED_FILLER_PHRASES = Object.freeze([
  /\bface time\b/i,
  /\blane widening\b/i,
  /\bmomentum in this cycle\b/i,
  /\bseparate from\b/i,
  /\bclean evaluation lane\b/i,
  /\bwidening lane\b/i,
  /\bthe gators want more face time\b/i,
  /\buf wants more face time\b/i,
  /\buf is separating from\b/i,
  /\buf is widening the lane\b/i,
  /\bthat lane is widening\b/i,
  /\bseparation path against\b/i,
  /\breal shot to separate from\b/i
]);

function validateBannedPhrases(text) {
  const violations = [];
  const t = String(text || '');
  for (const re of BANNED_FILLER_PHRASES) {
    if (re.test(t)) violations.push({ type: 'banned_filler', pattern: re.source });
  }
  return { ok: violations.length === 0, violations };
}

function hasBeatSourcedFact(facts = {}) {
  if (facts.quote) return true;
  if (facts.staffEnergy === true) return true;
  if (facts.visit?.when || facts.visit?.school) return true;
  if (facts.boardSignal) return true;
  if (facts.beatCompBattle) return true;
  return false;
}

function hasFactCompletenessForPr789(facts = {}, beatText = '') {
  if (!hasBeatSourcedFact(facts)) return false;
  const beat = String(beatText || '');
  if (facts.quote) return true;
  if (facts.staffEnergy && (facts.followUpSince || facts.quote)) return true;
  if (facts.staffEnergy && (facts.visit?.when || facts.visit?.school || facts.boardSignal)) return true;
  if (facts.visit?.when && facts.boardSignal) return true;
  if (facts.visit?.when && facts.staffEnergy) return true;
  if (facts.boardSignal && facts.quote) return true;
  if (facts.rpmTop?.length && facts.visit?.when) return true;
  if (facts.visit?.school && /visit|campus|gainesville|swamp/i.test(beat)) return true;
  return false;
}

function hasPartialFactsForPr789(facts = {}) {
  return hasBeatSourcedFact(facts);
}

module.exports = {
  BANNED_FILLER_PHRASES,
  validateBannedPhrases,
  hasBeatSourcedFact,
  hasFactCompletenessForPr789,
  hasPartialFactsForPr789
};

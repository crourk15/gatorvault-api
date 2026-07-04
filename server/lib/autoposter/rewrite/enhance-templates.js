/** PR-7/8/9 — legacy template narratives (non-golden beats only). */

const { lastName } = require('../strategy/strategy-sentences');
const { compLabel, resolveValidCompSchools } = require('./comp-sourcing');

function pickPr789Rewrite(ctx) {
  const ln = ctx.lastName;
  const beat = String(ctx.beatText || '').toLowerCase();
  const comps = compLabel(ctx.compSchools);

  if (/swamp|first trip/i.test(beat) && /top of my board|top schools/i.test(beat)) {
    return {
      narrative1: `${ln}'s first trip to The Swamp gave Florida real traction, and he left calling the Gators one of his top schools.`,
      narrative2: `That visit put UF on his early board, and the staff is pressing that connection.`
    };
  }

  if (/db coaches texting|all three.*db/i.test(beat) && /gainesville|leaderboard|cracked/i.test(beat)) {
    return {
      narrative1: `Florida's DB staff leaned in after ${ln}'s Gainesville visit, and he's responded.`,
      narrative2: `That trip pushed UF onto his early board, and the staff is staying active there.`
    };
  }

  if (/spring practice|on campus this spring/i.test(beat) && /top schools/i.test(beat)) {
    return {
      narrative1: `${ln}'s spring practice visit gave Florida a foothold, and he's already calling the Gators one of his top schools.`,
      narrative2: `UF is positioned early in his recruitment.`
    };
  }

  if (/energy from the staff|staff energy|loved the energy/i.test(beat)) {
    return {
      narrative1: `${ln} pointed to staff energy after his Florida campus visit, and that connection is still driving this recruitment.`,
      narrative2: `UF is pressing that staff relationship early in the cycle.`
    };
  }

  if (/early march|on campus at florida/i.test(beat)) {
    return {
      narrative1: `${ln} was on Florida's campus in early March, and that trip put UF in his early mix.`,
      narrative2: comps
        ? `Florida is pressing while ${comps} stay in the mix.`
        : `Florida is pressing that connection early.`
    };
  }

  if (comps) {
    return {
      narrative1: `${ln}'s campus visit gave Florida traction while ${comps} stay in the mix.`,
      narrative2: `UF is pressing early in this recruitment.`
    };
  }

  return {
    narrative1: `${ln}'s recent visit gave Florida real traction in this recruitment.`,
    narrative2: `UF has early positioning here, and the staff is pressing that connection.`
  };
}

function buildPr789Context(pr5Pack, signal) {
  const player = signal?.player || {};
  const trace = pr5Pack?.strategyTrace || pr5Pack?.trace || {};
  const beatText = pr5Pack?.beatText || signal?.beatText || signal?.event?.description || '';
  const compPack = resolveValidCompSchools({
    beatText,
    metrics: signal?.metrics,
    player,
    intel: signal?.intelligence || signal?.metrics?.intelligence
  });

  return {
    lastName: lastName(player.name || ''),
    fullName: player.name || '',
    classYear: player.classYear || '',
    position: player.pos || '',
    templateId: trace.templateId || '',
    beatText,
    compSchools: compPack.schools,
    rpmTop: compPack.rpmTop,
    confidence: trace.confidence || 'medium',
    beatFacts: pr5Pack?.beatFacts || signal?.metrics?.beatFacts || null
  };
}

module.exports = {
  pickPr789Rewrite,
  buildPr789Context
};

/** PR-7/8/9 — full enhanced narratives (designed to fit ≤280 with identity + URL). */

const { lastName } = require('../strategy/strategy-sentences');
const { compLabel } = require('./rewrite-templates');

function pickPr789Rewrite(ctx) {
  const ln = ctx.lastName;
  const beat = String(ctx.beatText || '').toLowerCase();
  const comps = compLabel(ctx.compSchools);
  const pos = ctx.position || '';
  const year = ctx.classYear || '';

  if (/swamp|first trip/i.test(beat) && /top of my board|top schools/i.test(beat)) {
    return {
      narrative1: `${ln}'s first trip to The Swamp gave Florida real traction, and he left calling the Gators one of his top schools.`,
      narrative2: `That visit opened a clean lane, and UF is pressing early with momentum building.`
    };
  }

  if (/db coaches|gainesville|leaderboard|cracked/i.test(beat)) {
    return {
      narrative1: `Florida's DB staff leaned in after ${ln}'s Gainesville visit, and he's responded.`,
      narrative2: `That trip pushed UF onto his early board, and the staff is spending capital to keep that lane open with real energy.`
    };
  }

  if (/spring practice|on campus this spring/i.test(beat)) {
    return {
      narrative1: `${ln}'s spring visit gave Florida a foothold, and he's already calling the Gators one of his top schools.`,
      narrative2: `UF is positioned early, and the staff is widening that lane.`
    };
  }

  if (/march|early march/i.test(beat) && comps) {
    return {
      narrative1: `${ln}'s March visit gave Florida a real shot to separate from ${comps}.`,
      narrative2: `UF wants more face time, and that lane is widening with momentum in this cycle.`
    };
  }

  return {
    narrative1: `${ln}'s visit gave Florida real traction in this recruitment.`,
    narrative2: `UF has early positioning here, and the staff is pressing that lane with momentum building.`
  };
}

function buildPr789Context(pr5Pack, signal) {
  const player = signal?.player || {};
  const trace = pr5Pack?.strategyTrace || {};
  return {
    lastName: lastName(player.name || ''),
    beatText: pr5Pack?.beatText || signal?.beatText || '',
    compSchools: pr5Pack?.compSchools || signal?.metrics?.compSchools || [],
    position: player.pos || pr5Pack?.position || '',
    classYear: player.classYear || pr5Pack?.classYear || '',
    templateId: trace.templateId || ''
  };
}

module.exports = {
  pickPr789Rewrite,
  buildPr789Context
};

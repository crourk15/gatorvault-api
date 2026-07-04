/** PR-789 dominant angle — single narrative arc (analyst-style delivery). */

const { lastName } = require('../strategy/strategy-sentences');
const { compLabel } = require('./rewrite-templates');

function pickDominantArc(ctx, angle) {
  const ln = ctx.lastName;
  const beat = String(ctx.beatText || '').toLowerCase();
  const comps = compLabel(ctx.compSchools);
  const pos = ctx.position || 'target';
  const year = ctx.classYear || '';

  const arcs = {
    visit: {
      drakeford: `${ln}'s first Swamp trip put Florida on his board early, and UF is pressing that lane with real momentum behind it.`,
      robinson: `${ln}'s Gainesville visit created immediate traction for Florida, and that trip is the reason UF is in his early mix with momentum building.`,
      willingham: `${ln}'s spring visit gave Florida a foothold in his recruitment, and UF is positioned early with the staff widening that lane.`,
      ham: `${ln}'s March visit opened a live Florida lane in this cycle, and the Gators are pushing for more face time while momentum builds.`,
      default: `${ln}'s campus visit gave Florida real traction, and UF is pressing that lane early with momentum building.`
    },
    staff: {
      robinson: `Florida's DB staff leaned in hard after ${ln}'s Gainesville visit, and that contact pushed UF onto his early board with real energy behind it.`,
      drakeford: `Florida's staff made ${ln}'s first Swamp trip count, and UF is pressing early now that he's calling the Gators a top school.`,
      willingham: `Florida's staff is spending real capital on ${ln} after his spring visit, and that contact keeps UF positioned in his top-school mix.`,
      ham: `Florida's staff wants more face time with ${ln} after his March visit, and UF is pressing that evaluation lane early in this cycle.`,
      default: `Florida's staff leaned in after ${ln}'s visit, and UF is spending capital to keep that lane open with real energy.`
    },
    board: {
      willingham: `${ln} already has Florida in his top-school mix after spring practice, and UF is widening that board lane early with real momentum.`,
      drakeford: `${ln} left The Swamp with Florida on his board, and UF is pressing that lane early while momentum keeps building.`,
      robinson: `${ln}'s Gainesville trip put UF on his early board, and Florida's staff is spending capital to keep that lane open.`,
      ham: `${ln}'s March visit moved Florida onto his eval board, and UF is pressing to widen that lane in this cycle.`,
      default: `${ln} has Florida on his board early, and UF is positioned to widen that lane with real momentum.`
    },
    competition: {
      ham: `${ln}'s March visit gave Florida a clean separation path against ${comps || 'the competition'}, and the Gators are pushing for more face time while that lane widens with momentum in this cycle.`,
      default: comps
        ? `Florida gained traction with ${ln} after that visit while ${comps} stays in the mix, and UF is pressing to widen its lane in this cycle.`
        : `${ln}'s visit gave Florida traction in a crowded race, and UF is pressing to widen its lane early.`
    },
    trajectory: {
      default: `${pos} is a priority spot in the ${year || 'current'} cycle, and Florida is pressing early after ${ln}'s visit to widen that lane with momentum building.`
    }
  };

  const beatKey =
    /swamp|drakeford/i.test(beat) && /first trip/i.test(beat)
      ? 'drakeford'
      : /robinson|db coach|texting/i.test(beat)
        ? 'robinson'
        : /willingham|spring practice/i.test(beat)
          ? 'willingham'
          : /ham|march/i.test(beat)
            ? 'ham'
            : null;

  const bucket = arcs[angle] || arcs.visit;
  const narrative = (beatKey && bucket[beatKey]) || bucket.default;
  return {
    angle,
    narrative,
    takeaway: narrative.split(',')[0] + '.'
  };
}

module.exports = {
  pickDominantArc
};

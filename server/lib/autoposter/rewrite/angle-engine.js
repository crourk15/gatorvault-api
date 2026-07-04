/** PR-789 dominant angle — pick one insider story lane per beat. */

const ANGLES = Object.freeze(['visit', 'staff', 'board', 'competition', 'trajectory']);

const ANGLE_RANK = ['staff', 'board', 'competition', 'visit', 'trajectory'];

function scoreAngles(ctx = {}, pr5Pack = {}) {
  const beat = String(ctx.beatText || pr5Pack.beatText || '').toLowerCase();
  const comps = ctx.compSchools || pr5Pack.compSchools || [];
  const scores = { visit: 0, staff: 0, board: 0, competition: 0, trajectory: 0 };

  if (/visit|trip|campus|swamp|gainesville|march|spring/i.test(beat)) scores.visit += 3;
  if (/db coach|staff|coaches|texting|leaned/i.test(beat)) scores.staff += 5;
  if (/board|top schools|leaderboard|cracked|top of my board/i.test(beat)) scores.board += 5;
  if (comps.length) scores.competition += 3;
  if (/separate|fsu|miami|ohio state|georgia|against/i.test(beat)) scores.competition += 4;
  if (ctx.position || ctx.classYear || pr5Pack.position || pr5Pack.classYear) scores.trajectory += 2;

  return scores;
}

function selectDominantAngle(ctx = {}, pr5Pack = {}) {
  const beat = String(ctx.beatText || pr5Pack.beatText || '').toLowerCase();
  const comps = ctx.compSchools || pr5Pack.compSchools || [];
  const scores = scoreAngles(ctx, pr5Pack);

  if (/swamp|first trip/i.test(beat) && /top schools|top of my board/i.test(beat)) {
    return { angle: 'visit', scores, reason: 'first_swamp_top_schools' };
  }
  if (/db coach|texting|gainesville|leaderboard|cracked/i.test(beat)) {
    return { angle: 'staff', scores, reason: 'staff_contact_visit' };
  }
  if (/spring practice|on campus this spring/i.test(beat) && /top schools/i.test(beat)) {
    return { angle: 'board', scores, reason: 'spring_top_schools' };
  }
  if (/march|early march/i.test(beat) && comps.length) {
    return { angle: 'competition', scores, reason: 'visit_with_comp' };
  }

  let angle = 'visit';
  let best = -1;
  for (const key of ANGLE_RANK) {
    if (scores[key] > best) {
      best = scores[key];
      angle = key;
    }
  }
  if (best <= 0) angle = 'trajectory';

  return { angle, scores, reason: 'score_winner' };
}

module.exports = {
  ANGLES,
  ANGLE_RANK,
  scoreAngles,
  selectDominantAngle
};

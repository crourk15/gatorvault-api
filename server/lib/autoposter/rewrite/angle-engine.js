/** PR-789 dominant angle — fact-driven selection when beat facts present. */



const ANGLES = Object.freeze(['visit', 'staff', 'board', 'competition', 'trajectory']);

const ANGLE_RANK = ['staff', 'board', 'competition', 'visit', 'trajectory'];

const { selectAngleFromFacts } = require('./beat-fact-extractor');



function scoreAngles(ctx = {}, pr5Pack = {}) {

  const beat = String(ctx.beatText || pr5Pack.beatText || '').toLowerCase();

  const comps = ctx.compSchools || pr5Pack.compSchools || [];

  const scores = { visit: 0, staff: 0, board: 0, competition: 0, trajectory: 0 };



  if (/visit|trip|campus|swamp|gainesville|march|spring/i.test(beat)) scores.visit += 3;

  if (/energy from the staff|staff energy|coaches|texting|leaned/i.test(beat)) scores.staff += 5;

  if (/board|top schools|leaderboard|cracked|top of my board/i.test(beat)) scores.board += 5;

  if (comps.length && /battle|against|separate|mix/i.test(beat)) scores.competition += 4;

  if (ctx.position || ctx.classYear || pr5Pack.position || pr5Pack.classYear) scores.trajectory += 2;



  return scores;

}



function selectDominantAngle(ctx = {}, pr5Pack = {}) {

  if (ctx.beatFacts) {

    const pick = selectAngleFromFacts(ctx.beatFacts);

    return { angle: pick.angle, scores: scoreAngles(ctx, pr5Pack), reason: pick.reason || 'beat_facts' };

  }



  const beat = String(ctx.beatText || pr5Pack.beatText || '').toLowerCase();

  const scores = scoreAngles(ctx, pr5Pack);



  if (/swamp|first trip/i.test(beat) && /top schools|top of my board/i.test(beat)) {

    return { angle: 'visit', scores, reason: 'first_swamp_top_schools' };

  }

  if (/energy from the staff|staff energy|db coach|texting|gainesville|leaderboard|cracked/i.test(beat)) {

    return { angle: 'staff', scores, reason: 'staff_contact_visit' };

  }

  if (/spring practice|on campus this spring/i.test(beat) && /top schools/i.test(beat)) {

    return { angle: 'board', scores, reason: 'spring_top_schools' };

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


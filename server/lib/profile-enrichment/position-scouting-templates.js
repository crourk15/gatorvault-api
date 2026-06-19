/**
 * UF Premium position scouting templates — used when manual overrides are absent.
 */
const POSITION_TEMPLATES = {
  QB: {
    strengths: ['Arm talent and timing in the intermediate game', 'Poise under pressure in the pocket', 'Leadership and command of the huddle'],
    weaknesses: ['Decision speed vs. disguised coverages', 'Consistency on deep-ball accuracy'],
    schemeFit: 'Spread passing quarterback who can distribute on rhythm and extend when structure breaks down.',
    projection: 'SEC-caliber signal-caller with starter trajectory in Billy Napier\'s system.'
  },
  RB: {
    strengths: ['Vision and patience between the tackles', 'Contact balance through second-level defenders', 'Pass-catching reliability out of the backfield'],
    weaknesses: ['Top-end breakaway speed in the open field', 'Pass protection technique vs. blitzers'],
    schemeFit: 'Every-down back who fits UF\'s inside/outside zone and screen package.',
    projection: 'Rotation back with early-down and short-yardage value in the SEC.'
  },
  WR: {
    strengths: ['Route nuance and separation at all three levels', 'Hands and body control in traffic', 'Yards-after-catch burst in space'],
    weaknesses: ['Contested-catch wins vs. longer corners', 'Physicality as a perimeter blocker'],
    schemeFit: 'Move-the-chains receiver in UF\'s spread passing attack — slot or boundary.',
    projection: 'SEC rotation contributor with red-zone and third-down upside.'
  },
  TE: {
    strengths: ['Inline blocking strength at the point of attack', 'Soft hands as a seam and intermediate target', 'Red-zone presence as a mismatch'],
    weaknesses: ['Long-speed separation vs. safeties', 'Route precision at the top of breaks'],
    schemeFit: 'Hybrid Y attached to UF\'s run game and play-action passing.',
    projection: 'Starter-caliber tight end in a pro-style spread if development continues.'
  },
  OL: {
    strengths: ['Core strength and pad level in the run game', 'Hand placement and footwork in pass pro', 'Football IQ in protection calls'],
    weaknesses: ['Recovery speed vs. elite edge speed', 'Consistency finishing blocks to the whistle'],
    schemeFit: 'Interior or tackle fit in UF\'s zone-heavy run scheme and vertical passing game.',
    projection: 'SEC starter track with NFL size and developmental upside.'
  },
  DL: {
    strengths: ['Get-off and first-step quickness at the line', 'Hand usage to disengage blockers', 'Motor and finish rate in pursuit'],
    weaknesses: ['Anchor vs. double teams on early downs', 'Counter moves vs. veteran tackles'],
    schemeFit: 'Defensive lineman in Billy White\'s odd-front pressure packages.',
    projection: 'Rotation-to-starter defensive lineman with SEC production upside.'
  },
  JACK: {
    strengths: ['Explosive first step off the edge', 'Pass-rush bend and finish ability', 'Versatility to drop into short zones'],
    weaknesses: ['Setting the edge vs. power run schemes', 'Counter move repertoire vs. elite tackles'],
    schemeFit: 'Primary edge blitzer and setter in Brad White\'s 3-3-5 odd front.',
    projection: 'All-SEC caliber edge defender with NFL draft ceiling.'
  },
  LB: {
    strengths: ['Instincts and pursuit angles to the football', 'Tackling reliability in space', 'Coverage awareness in zone drops'],
    weaknesses: ['Block shedding vs. bigger linemen', 'Man-coverage matchups on shifty backs'],
    schemeFit: 'Inside or outside linebacker in UF\'s multiple front and nickel packages.',
    projection: 'SEC starter with special-teams value and defensive rotation upside.'
  },
  ILB: {
    strengths: ['Instincts and pursuit angles to the football', 'Tackling reliability in space', 'Coverage awareness in zone drops'],
    weaknesses: ['Block shedding vs. bigger linemen', 'Man-coverage matchups on shifty backs'],
    schemeFit: 'Inside linebacker in UF\'s 3-3-5 stack and run-fit responsibilities.',
    projection: 'SEC rotation linebacker with starter trajectory.'
  },
  CB: {
    strengths: ['Coverage twitch and recovery speed in phase', 'Ball skills and route recognition', 'Press technique at the line of scrimmage'],
    weaknesses: ['Physicality vs. bigger receivers', 'Tackle consistency in run support'],
    schemeFit: 'Boundary or field corner in UF\'s man and zone coverages.',
    projection: 'SEC starter with NFL secondary upside if consistency holds.'
  },
  STAR: {
    strengths: ['Hybrid coverage and blitz versatility', 'Twitch and short-area closing speed', 'Matchup flexibility in nickel packages'],
    weaknesses: ['Size vs. bigger slot receivers', 'Run-fit discipline vs. heavy sets'],
    schemeFit: 'STAR/nickel defender in UF\'s sub-package defense.',
    projection: 'High-impact nickel with every-down sub-package value.'
  },
  DB: {
    strengths: ['Coverage twitch and recovery speed in phase', 'Ball skills and route recognition', 'Versatility to play multiple secondary spots'],
    weaknesses: ['Physicality vs. bigger receivers', 'Tackle consistency in run support'],
    schemeFit: 'Secondary depth piece in UF\'s multiple coverage looks.',
    projection: 'SEC rotation defensive back with special-teams value.'
  },
  K: {
    strengths: ['Leg strength on field goals and kickoffs', 'Routine consistency in pressure moments', 'Holder operation reliability'],
    weaknesses: ['Deep-range accuracy in adverse weather', 'Directional kickoff placement'],
    schemeFit: 'Special teams specialist in UF\'s field-position game.',
    projection: 'Reliable place-kicker with game-winning upside.'
  },
  P: {
    strengths: ['Hang time and directional punting', 'Operation speed and consistency', 'Pinning ability inside the 20'],
    weaknesses: ['Consistency in wet or windy conditions', 'Rugby-style placement when needed'],
    schemeFit: 'Field-position weapon in UF\'s complementary special teams unit.',
    projection: 'SEC-caliber punter with hidden-yardage value.'
  },
  LS: {
    strengths: ['Snap accuracy and velocity on operation', 'Coverage reliability after the snap', 'Consistency in high-leverage moments'],
    weaknesses: ['Limited positional versatility elsewhere'],
    schemeFit: 'Long-snap specialist on UF\'s punt and field-goal units.',
    projection: 'Reliable long snapper with multi-year starter stability.'
  }
};

function templateForPosition(pos) {
  const key = String(pos || '').toUpperCase();
  if (POSITION_TEMPLATES[key]) return POSITION_TEMPLATES[key];
  if (['OT', 'OG', 'C', 'IOL'].includes(key)) return POSITION_TEMPLATES.OL;
  if (['DE', 'DT', 'EDGE', 'NT'].includes(key)) return POSITION_TEMPLATES.DL;
  if (['S', 'SAF', 'FS', 'SS'].includes(key)) return POSITION_TEMPLATES.DB;
  return POSITION_TEMPLATES.LB;
}

function eligibilityYearsRemaining(classYear) {
  const cls = String(classYear || '').trim();
  if (/^Gr/i.test(cls)) return 0;
  if (/^R-Sr|^Sr/i.test(cls)) return 1;
  if (/^R-Jr|^Jr/i.test(cls)) return 2;
  if (/^R-So|^So/i.test(cls)) return 3;
  if (/^R-Fr|^Fr/i.test(cls)) return 4;
  return null;
}

function positionGradeFromRating(rating) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return null;
  if (r >= 88) return 'A';
  if (r >= 84) return 'A-';
  if (r >= 80) return 'B+';
  if (r >= 76) return 'B';
  if (r >= 72) return 'B-';
  if (r >= 68) return 'C+';
  return 'C';
}

function fitScoreFromRating(rating, transfer) {
  const r = Number(rating);
  if (!Number.isFinite(r)) return null;
  let score = Math.round(Math.min(99, Math.max(55, r)));
  if (transfer) score = Math.min(99, score + 2);
  return score;
}

function nilValuationEstimate(player) {
  const rating = Number(player.displayRating ?? player.rating ?? 0);
  const stars = Number(player.stars || 0);
  const tier = String(player.depthChartTier || '');
  let base = 15000;
  if (stars >= 5) base = 450000;
  else if (stars >= 4) base = 180000;
  else if (rating >= 86) base = 320000;
  else if (rating >= 82) base = 120000;
  else if (rating >= 78) base = 65000;
  if (tier === 'starter') base = Math.round(base * 1.35);
  if (player.transferInfo) base = Math.round(base * 1.1);
  return base;
}

function injuryHistoryLabel(injury) {
  const code = String(injury || 'green').toLowerCase();
  if (code === 'red') return 'Currently managing an injury — monitor spring availability.';
  if (code === 'yellow') return 'Minor injury history — expected to be available.';
  return 'No significant injury history on file.';
}

function recruitingBackground(player) {
  const parts = [];
  if (player.stars) parts.push(`${player.stars}-star recruit`);
  if (player.hometown) parts.push(player.hometown);
  if (player.transferInfo) parts.push(player.transferInfo);
  return parts.length ? parts.join(' · ') : 'Florida roster addition.';
}

function developmentProjection(player, template) {
  if (player.projection) return player.projection;
  const tier = String(player.depthChartTier || '');
  if (tier === 'starter') return template.projection.replace('rotation', 'starter');
  if (tier === 'developmental') return `Developmental ${String(player.pos || '').toLowerCase()} with special-teams and depth-chart climb potential.`;
  return template.projection;
}

module.exports = {
  POSITION_TEMPLATES,
  templateForPosition,
  eligibilityYearsRemaining,
  positionGradeFromRating,
  fitScoreFromRating,
  nilValuationEstimate,
  injuryHistoryLabel,
  recruitingBackground,
  developmentProjection
};

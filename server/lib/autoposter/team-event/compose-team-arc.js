/**
 * Deterministic team event narrative arcs.
 */
const { selectTeamArc } = require('./team-fact-extractor');

function composeKickoffArc(facts = {}) {
  const opponent = facts.opponent || 'the opponent';
  const time = facts.kickoff_time || 'a set kickoff window';
  const network = facts.network ? ` on ${facts.network}` : '';
  const venue = facts.venue ? ` at ${facts.venue}` : facts.home_away === 'home' ? ' at The Swamp' : '';
  return {
    identity: 'Florida Gators — Kickoff Alert',
    context: `Florida vs ${opponent} kickoff is locked for ${time}${network}${venue}.`,
    insider: 'The national TV window puts another SEC spotlight test on the Gators early in the cycle.',
    arc: 'kickoff'
  };
}

function composeScheduleArc(facts = {}) {
  const opponent = facts.opponent || 'the next SEC opponent';
  const week = facts.week_number ? ` in Week ${facts.week_number}` : '';
  const network = facts.network ? ` on ${facts.network}` : '';
  return {
    identity: 'Florida Gators — Schedule Update',
    context: `Florida's schedule${week} now has a verified ${opponent} slot${network}.`,
    insider: 'The timing keeps UF aligned with the SEC broadcast rotation as the calendar firms up.',
    arc: 'schedule'
  };
}

function composeGameWeekArc(facts = {}) {
  const opponent = facts.opponent || 'the next opponent';
  const venue = facts.home_away === 'away' ? ' on the road' : ' at The Swamp';
  return {
    identity: 'Florida Gators — Game Week',
    context: `Florida opens game week against ${opponent}${venue} with the staff locking final prep plans.`,
    insider: 'The matchup sets the tone for how the Gators stack up in the SEC lane this week.',
    arc: 'game_week'
  };
}

function composeUniformArc(facts = {}) {
  const beat = String(facts.beatText || '');
  const look = /\ball[-\s]?orange\b/i.test(beat)
    ? 'all-orange uniforms'
    : /\bthrowback\b/i.test(beat)
      ? 'throwback uniforms'
      : /\balternate\b/i.test(beat)
        ? 'alternate uniforms'
        : 'a new uniform look';
  return {
    identity: 'Florida Gators — Uniform Look',
    context: `Florida is rolling out ${look} for an upcoming game, per the verified beat report.`,
    insider: 'The look keeps the Gators in the national brand conversation on game day.',
    arc: 'uniform'
  };
}

function composeStaffArc(facts = {}) {
  const name = facts.staff_name || 'a verified staff addition';
  const role = facts.staff_role || 'a new role on staff';
  const action = facts.staff_action || 'named';
  let context;
  if (action === 'promoted') {
    context = `Florida promoted ${name} to ${role}, per the verified beat report.`;
  } else if (action === 'hired') {
    context = `Florida hired ${name} as ${role}, per the verified beat report.`;
  } else if (action === 'resigned') {
    context = `${name} stepped down from ${role} at Florida, per the verified beat report.`;
  } else {
    context = `Florida named ${name} as ${role}, per the verified beat report.`;
  }
  return {
    identity: 'Florida Gators — Staff Move',
    context,
    insider: 'The staff move keeps Florida aligned with its on-field identity and recruiting footprint.',
    arc: 'staff'
  };
}

function composeDepthChartArc(facts = {}) {
  const name = facts.player_name || 'a verified Gator';
  const role = facts.depth_role || facts.player_pos || 'a new role';
  const pos = facts.player_pos && facts.depth_role !== facts.player_pos ? ` (${facts.player_pos})` : '';
  return {
    identity: 'Florida Gators — Depth Chart',
    context: `${name}${pos} is listed at ${role} on Florida's updated depth chart, per the verified beat report.`,
    insider: 'The two-deep shuffle reshapes how Florida plans snaps and matchups in the SEC lane.',
    arc: 'depth_chart'
  };
}

function composeInjuryArc(facts = {}) {
  const name = facts.player_name || 'a verified Gator';
  const status = facts.injury_status || 'dealing with an injury update';
  const pos = facts.player_pos ? ` (${facts.player_pos})` : '';
  return {
    identity: 'Florida Gators — Injury Report',
    context: `${name}${pos} is ${status} for Florida, per the verified beat report.`,
    insider: 'Availability shakes up who the staff trusts in the two-deep this week.',
    arc: 'injury'
  };
}

function composeGeneralArc(facts = {}) {
  const opponent = facts.opponent ? ` against ${facts.opponent}` : '';
  return {
    identity: 'Florida Gators — Team Update',
    context: `Florida posted a verified football operations update${opponent} from the beat wire.`,
    insider: 'Staff and roster impact still being tracked across the building.',
    arc: 'general'
  };
}

function composeTeamArc(facts = {}, ctx = {}) {
  const arc = selectTeamArc(facts);
  switch (arc) {
    case 'kickoff':
      return composeKickoffArc(facts);
    case 'schedule':
      return composeScheduleArc(facts);
    case 'game_week':
      return composeGameWeekArc(facts);
    case 'uniform':
      return composeUniformArc(facts);
    case 'staff':
      return composeStaffArc(facts);
    case 'depth_chart':
      return composeDepthChartArc(facts);
    case 'injury':
      return composeInjuryArc(facts);
    default:
      return composeGeneralArc(facts, ctx);
  }
}

module.exports = {
  composeKickoffArc,
  composeScheduleArc,
  composeGameWeekArc,
  composeUniformArc,
  composeStaffArc,
  composeDepthChartArc,
  composeInjuryArc,
  composeGeneralArc,
  composeTeamArc
};
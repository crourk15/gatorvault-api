/** Team event elite compose — kickoff / schedule / game week golden beats. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { composeTeamElitePost, THIN_FALLBACK_RE, eliteComposeEnabled } = require('../../lib/autoposter/team-event/team-compose');
const { extractTeamFacts } = require('../../lib/autoposter/team-event/team-fact-extractor');
const { computeTeamDedupeKey } = require('../../lib/autoposter/team-event/team-dedupe');
const {
  isRecruitingDominantTeamBeat,
  passesTeamDetectionGate,
  validateTeamCompose
} = require('../../lib/autoposter/team-event/team-gates');

const KICKOFF_BEAT =
  'Florida vs LSU kickoff set for 7:30 p.m. ET on ESPN at Ben Hill Griffin Stadium.';
const SCHEDULE_BEAT =
  'Florida vs Georgia moved to Week 6 on CBS — SEC schedule update for the Gators.';
const GAME_WEEK_BEAT = 'Florida game week vs Tennessee at The Swamp — matchup preview from Gainesville.';
const RUMOR_BEAT =
  'Hearing rumors Florida could move kickoff vs LSU — nothing confirmed yet.';
const MIXED_RECRUITING =
  '2027 four-star WR is set to visit Florida the same weekend as the LSU kickoff on ESPN.';

test('elite compose enabled unless env disables', () => {
  assert.equal(eliteComposeEnabled(), process.env.X_AUTOPOST_TEAM_ELITE_COMPOSE !== 'false');
});

test('kickoff golden compose', () => {
  const facts = extractTeamFacts(KICKOFF_BEAT, { teamEventType: 'kickoff' });
  assert.equal(facts.opponent, 'LSU');
  assert.match(facts.kickoff_time, /7:30/i);
  assert.equal(facts.network, 'ESPN');
  const built = composeTeamElitePost({ beatText: KICKOFF_BEAT, source: 'Gators Online', teamEventType: 'kickoff' });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'kickoff');
  assert.match(built.text, /Kickoff Alert/i);
  assert.match(built.text, /LSU/i);
  assert.doesNotMatch(built.text, THIN_FALLBACK_RE);
  assert.ok(computeTeamDedupeKey(built.facts));
});

test('schedule golden compose', () => {
  const built = composeTeamElitePost({ beatText: SCHEDULE_BEAT, source: 'SEC Network', teamEventType: 'schedule' });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'schedule');
  assert.match(built.text, /Schedule Update/i);
  assert.match(built.text, /Georgia/i);
});

test('game week golden compose', () => {
  const built = composeTeamElitePost({ beatText: GAME_WEEK_BEAT, source: 'Beat intel', teamEventType: 'game_week' });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'game_week');
  assert.match(built.text, /Game Week/i);
  assert.match(built.text, /Tennessee/i);
});

test('rumor blocked', () => {
  const gate = passesTeamDetectionGate(RUMOR_BEAT);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'rumor_blocked');
  const built = composeTeamElitePost({ beatText: RUMOR_BEAT, source: 'Beat intel' });
  assert.equal(built.ok, false);
});

test('mixed recruiting+kickoff blocked', () => {
  assert.equal(isRecruitingDominantTeamBeat(MIXED_RECRUITING), true);
  const built = composeTeamElitePost({ beatText: MIXED_RECRUITING, source: 'Beat intel' });
  assert.equal(built.ok, false);
  assert.equal(built.reason, 'recruiting_dominant');
});


test('staff hire golden compose', () => {
  const STAFF_BEAT =
    'Florida named Austin Lehman co-defensive coordinator, staff source confirms.';
  const facts = extractTeamFacts(STAFF_BEAT, { teamEventType: 'staff' });
  assert.equal(facts.staff_name, 'Austin Lehman');
  assert.equal(facts.staff_role, 'co-defensive coordinator');
  const built = composeTeamElitePost({ beatText: STAFF_BEAT, source: 'Beat intel', teamEventType: 'staff' });
  assert.equal(built.ok, true, built.reason || JSON.stringify(built));
  assert.equal(built.arc, 'staff');
  assert.match(built.text, /Staff Move/i);
  assert.match(built.text, /Austin Lehman/i);
  assert.match(built.text, /co-defensive coordinator/i);
});

test('unconfirmed staff rumor blocked', () => {
  const beat = 'Hearing rumors Florida could hire a new defensive coordinator — nothing confirmed.';
  const gate = passesTeamDetectionGate(beat);
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, 'rumor_blocked');
});test('THIN_FALLBACK_RE blocks legacy monitoring copy', () => {
  const legacy = 'Florida schedule update: kickoff change. Monitoring staff/roster impact.';
  assert.match(legacy, THIN_FALLBACK_RE);
  assert.equal(validateTeamCompose(legacy).ok, false);
});
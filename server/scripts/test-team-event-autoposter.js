/**
 * Team event autoposter — schedule/kickoff/staff posts without playerSlug.
 */
const prefilter = require('../lib/beat-intel-prefilter');
const copy = require('../lib/x-autoposter-copy');
const gm2Rules = require('../lib/gm2/rules-engine');
const validation = require('../lib/x-autoposter-validation');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const TEAM_EXAMPLES = [
  {
    text: 'Florida vs LSU kickoff set for 7:30 p.m. ET on ESPN — Ben Hill Griffin Stadium.',
    type: 'kickoff'
  },
  {
    text: 'Gators will wear all-orange uniforms vs FAU in the season opener, per @GatorsFB.',
    type: 'uniform'
  },
  {
    text: 'Florida named Austin Lehman co-defensive coordinator, staff source confirms.',
    type: 'staff'
  },
  {
    text: 'Updated depth chart from spring: DJ Coleman at FS, Bryce Thornton at SS for the Gators.',
    type: 'depth_chart'
  }
];

(async () => {
  for (const { text, type } of TEAM_EXAMPLES) {
    assert(`classifies ${type}`, prefilter.classifyTeamEventType(text) === type);
    assert(`team intel: ${type}`, prefilter.isTeamEventIntel(text));
    const gate = prefilter.evaluateTeamEventEligibility(text);
    assert(`eligible ${type}`, gate.eligible && gate.triggerType === 'team_event');
  }

  const playerLine =
    '2027 4-Star WR Jaylen Brown is set to visit Florida this weekend per @GatorsOnline.';
  assert('player visit is not team event', !prefilter.isTeamEventIntel(playerLine));

  const blog = 'Our weekend official visitor blog is loaded with intel on the way';
  assert('blog promo is not team event', !prefilter.isTeamEventIntel(blog));

  const kickoffPost = {
    text: 'Florida vs LSU kickoff set for 7:30 p.m. ET on ESPN at The Swamp.',
    writerName: 'Gators Online',
    handle: 'gatorsonline',
    url: 'https://example.com/kickoff'
  };
  const guarded = await prefilter.guardBeatPost(kickoffPost);
  assert('guardBeatPost allows kickoff tweet', guarded.eligible && guarded.triggerType === 'team_event');

  const built = await copy.buildBeatIntelCopyAsync(kickoffPost);
  assert('buildBeatIntelCopyAsync produces text', built?.text && built.text.includes('Florida Gators'));
  assert('not non-player skip', !prefilter.isNonPlayerIntelSkip(built));

  const candidate = {
    text: built.text,
    category: 'news',
    triggerType: 'team_event',
    teamEventType: 'kickoff',
    sourceEventType: 'team_event',
    source: 'auto:team-event',
    sources: [{ label: 'Gators Online', url: kickoffPost.url }],
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    playerContext: built.playerContext,
    sourceEventCreatedAt: new Date().toISOString()
  };
  assert('GM2 allows team_event', gm2Rules.rulesForAutoposter({ ...candidate, triggerType: 'team_event' }).allow === true);
  const quality = validation.passesNewsQualityGate(candidate);
  assert('passes news quality gate', quality.pass);

  const scheduleBuilt = copy.buildTeamEventCopyFromSchedule({
    id: 'uf-lsu-2026',
    game: 'Florida vs LSU',
    opponent: 'LSU',
    date: '2026-10-10T23:30:00.000Z',
    venue: 'Ben Hill Griffin Stadium'
  });
  assert('schedule copy builder', scheduleBuilt?.text && scheduleBuilt.triggerType === 'team_event');

  if (process.exitCode) {
    console.error('\nTeam event autoposter tests failed.');
  } else {
    console.log('\nAll team event autoposter tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

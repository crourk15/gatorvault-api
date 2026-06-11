/**
 * PROGRAM_NEWS autoposter — stadium, NIL, SEC/TV, realignment, branding.
 */
const prefilter = require('../lib/beat-intel-prefilter');
const copy = require('../lib/x-autoposter-copy');
const gm2Rules = require('../lib/gm2/rules-engine');
const validation = require('../lib/x-autoposter-validation');
const ingest = require('../lib/beat-writer-ingest');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const PROGRAM_EXAMPLES = [
  {
    text: 'Florida is planning a $1.45 billion renovation of Ben Hill Griffin Stadium, per sources.',
    type: 'stadium_facility',
    handle: 'zachabolverdi'
  },
  {
    text: 'UF athletics announced a major NIL collective infrastructure partnership with Gator Boost.',
    type: 'nil_infrastructure',
    handle: 'gatorsonline'
  },
  {
    text: 'SEC announces flex scheduling and updated national TV windows affecting Florida.',
    type: 'sec_tv',
    handle: 'alligator'
  },
  {
    text: 'Conference realignment chatter continues as SEC expansion talks heat up for Florida.',
    type: 'realignment',
    handle: 'onlygators'
  },
  {
    text: 'Florida Gators will unveil new alternate uniforms and branding at spring game.',
    type: 'branding',
    handle: 'GatorsOnline'
  }
];

(async () => {
  for (const { text, type } of PROGRAM_EXAMPLES) {
    assert(`classifies ${type}`, prefilter.classifyProgramNewsType(text) === type);
    assert(`program intel: ${type}`, prefilter.isProgramNewsIntel(text));
    const gate = prefilter.evaluateProgramNewsEligibility(text);
    assert(`eligible ${type}`, gate.eligible && gate.triggerType === 'program_news');
  }

  const kickoff =
    'Florida vs LSU kickoff set for 7:30 p.m. ET on ESPN — Ben Hill Griffin Stadium.';
  assert('kickoff stays team_event not program_news', prefilter.isTeamEventIntel(kickoff));
  assert('kickoff not program_news', !prefilter.isProgramNewsIntel(kickoff));

  const playerLine =
    '2027 4-Star WR Jaylen Brown is set to visit Florida this weekend per @GatorsOnline.';
  assert('player visit is not program news', !prefilter.isProgramNewsIntel(playerLine));

  const stadiumPost = {
    text: 'Florida is planning a $1.45 billion renovation of Ben Hill Griffin Stadium, per @ZachAbolverdi.',
    writerName: 'Zach Abolverdi',
    handle: 'zachabolverdi',
    url: 'https://example.com/stadium'
  };
  const guarded = await prefilter.guardBeatPost(stadiumPost);
  assert(
    'guardBeatPost allows stadium tweet',
    guarded.eligible && guarded.triggerType === 'program_news'
  );

  const built = await copy.buildBeatIntelCopyAsync(stadiumPost);
  assert('buildBeatIntelCopyAsync produces text', built?.text && built.text.includes('Florida'));
  assert('not non-player skip', !prefilter.isNonPlayerIntelSkip(built));

  const candidate = {
    text: built.text,
    category: 'news',
    triggerType: 'program_news',
    programNewsType: 'stadium_facility',
    sourceEventType: 'program_news',
    source: 'auto:program-news',
    sources: [{ label: 'Zach Abolverdi', url: stadiumPost.url }],
    templateBlocks: built.templateBlocks,
    validationMeta: built.validationMeta,
    playerContext: built.playerContext,
    sourceEventCreatedAt: new Date().toISOString()
  };
  assert(
    'GM2 allows program_news',
    gm2Rules.rulesForAutoposter({ ...candidate, triggerType: 'program_news' }).allow === true
  );
  const quality = validation.passesNewsQualityGate(candidate);
  assert('passes news quality gate', quality.pass);

  const row = ingest.parseBeatPostForVisitIntel(stadiumPost, { logSkips: false });
  assert('beat ingest parses program_news row', row?.eventType === 'program_news');
  assert('beat ingest fingerprint', row?.fingerprint?.startsWith('program_news_'));

  const playerContext = require('../lib/x-autoposter-player-context');
  const minimal = playerContext.buildProgramNewsPost({
    beatText: 'Florida stadium update.',
    source: 'Zach Abolverdi',
    programNewsType: 'stadium_facility'
  });
  assert(
    'fallback copy when intel incomplete',
    minimal?.text && /Per multiple reports, Florida has announced/.test(minimal.text)
  );

  if (process.exitCode) {
    console.error('\nProgram news autoposter tests failed.');
  } else {
    console.log('\nAll program news autoposter tests passed.');
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

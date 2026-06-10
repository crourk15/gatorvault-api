/**
 * Unit tests — editorial synthesis engine and draft quality.
 */
const cycle = require('../lib/insider-articles-cycle');
const sanitize = require('../lib/insider-articles-sanitize');
const templates = require('../lib/insider-articles-templates');
const editorial = require('../lib/insider-articles-editorial');
const engine = require('../lib/insider-articles-engine');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const MOCK_SIGNALS = {
  collectedAt: new Date().toISOString(),
  season: 2026,
  recruiting: {
    players: [
      { slug: 'jaylen-brown-2027', name: 'Jaylen Brown', pos: 'WR', stars: 4, classYear: 2027, school: 'North Gwinnett HS', natlRank: 42 },
      { slug: 'trey-morrison-2027', name: 'Trey Morrison', pos: 'WR', stars: 5, classYear: 2027, school: 'American Heritage', natlRank: 18 }
    ],
    targets: [
      { slug: 'jaylen-brown-2027', name: 'Jaylen Brown', pos: 'WR', stars: 4, classYear: 2027, category: 'target' },
      { slug: 'trey-morrison-2027', name: 'Trey Morrison', pos: 'WR', stars: 5, classYear: 2027, category: 'target' }
    ],
    commits: [],
    minClass: 2027
  },
  intel: {
    all: [
      {
        playerName: 'Jaylen Brown',
        playerSlug: 'jaylen-brown-2027',
        classYear: 2027,
        eventType: 'official_visit',
        detail: '2027 four-star WR Jaylen Brown will take an official visit to Gainesville this weekend with family and position coaches.',
        visitStart: 'June 14'
      }
    ],
    upcoming: [
      {
        playerName: 'Jaylen Brown',
        playerSlug: 'jaylen-brown-2027',
        classYear: 2027,
        eventType: 'official_visit',
        detail: '2027 four-star WR Jaylen Brown will take an official visit to Gainesville this weekend.',
        visitStart: 'June 14'
      }
    ],
    recent: [],
    visits: []
  },
  heatCheck: { rising: [] },
  roster: {
    players: Array.from({ length: 85 }, (_, i) => ({ name: `Player ${i}`, pos: i % 3 === 0 ? 'WR' : i % 3 === 1 ? 'EDGE' : 'CB', unit: i % 2 ? 'defense' : 'offense' })),
    offense: new Array(40),
    defense: new Array(40)
  },
  portal: { count: 2, incoming: [{ name: 'John Smith', pos: 'WR', stars: 4 }] }
};

(async () => {
  assert('2027 recruit included', cycle.isRecruitingClassPlayer({ classYear: 2027, name: 'Test Player' }));

  const risingTopic = {
    category: 'heat_check',
    title: 'Heat Check: 2027 class momentum — Jaylen Brown',
    classYear: 2027,
    topicKey: 'test_heat',
    cycleType: 'recruiting',
    signals: {
      rising: [
        {
          playerName: 'Jaylen Brown',
          playerSlug: 'jaylen-brown-2027',
          pos: 'WR',
          stars: 4,
          classYear: 2027,
          trigger: 'rpm_uf',
          triggerLabel: 'On3 RPM → Florida',
          detail: 'On3 RPM: Florida 52.3% · next Georgia 31.1%',
          school: 'North Gwinnett HS',
          natlRank: 42
        },
        {
          playerName: 'Trey Morrison',
          playerSlug: 'trey-morrison-2027',
          pos: 'WR',
          stars: 5,
          classYear: 2027,
          trigger: 'visit_uf_leads',
          triggerLabel: 'Visit intel · UF leads',
          detail: 'Recent Florida visit · RPM 44.2% · close to Alabama 41.0%',
          school: 'American Heritage',
          natlRank: 18
        }
      ]
    },
    sources: [{ name: 'On3 RPM', outlet: 'On3' }]
  };

  const ctx = editorial.assembleRecruitingContext(risingTopic, MOCK_SIGNALS);
  assert('assembles recruiting context', ctx && ctx.bundles.length >= 2);
  assert('meets minimum intel threshold', editorial.hasMinimumIntel(ctx, 'heat_check'));

  const heatDraft = templates.buildArticleDraft(risingTopic, MOCK_SIGNALS);
  assert('heat check editorial draft generated', heatDraft && heatDraft.body.includes('Overview'));
  assert('heat check has analysis section', heatDraft.body.includes('Analysis'));
  assert('heat check mentions Florida RPM', /Florida|RPM/i.test(heatDraft.body));
  assert('heat check word count', templates.validateDraftQuality(heatDraft).words >= templates.MIN_WORDS);
  assert('heat check rejects boilerplate', !sanitize.isGenericBoilerplateBody(heatDraft.body));

  const thinTopic = {
    category: 'heat_check',
    title: 'Heat Check: thin',
    classYear: 2027,
    signals: { rising: [{ playerName: 'X Y', pos: 'WR' }] },
    sources: []
  };
  const thinDraft = templates.buildArticleDraft(thinTopic, MOCK_SIGNALS);
  assert('thin intel produces no draft', thinDraft === null);

  const visitTopic = {
    category: 'official_visit_preview',
    title: 'Official Visit Preview: Jaylen Brown',
    classYear: 2027,
    topicKey: 'test_ov',
    cycleType: 'recruiting',
    signals: {
      visits: MOCK_SIGNALS.intel.upcoming
    },
    sources: [{ name: 'Beat', outlet: 'Beat Report' }]
  };
  const visitDraft = templates.buildArticleDraft(visitTopic, MOCK_SIGNALS);
  assert('visit preview draft when intel exists', visitDraft && visitDraft.body.includes('Jaylen Brown'));

  const programTopic = {
    category: 'program_pulse',
    title: 'Program Pulse: 2026 roster',
    classYear: 2026,
    topicKey: 'test_program',
    cycleType: 'program',
    signals: {
      portal: MOCK_SIGNALS.portal,
      roster: MOCK_SIGNALS.roster
    },
    sources: [{ name: 'GatorVault', outlet: 'GatorVault' }]
  };
  const programDraft = templates.buildArticleDraft(programTopic, MOCK_SIGNALS);
  assert('program pulse draft', programDraft && programDraft.body.includes('Overview'));

  const signals = await engine.collectSignals();
  assert('live signals have roster', signals.roster.players.length > 0);

  if (process.exitCode) console.error('\nEditorial article tests failed.');
  else console.log('\nAll editorial article tests passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

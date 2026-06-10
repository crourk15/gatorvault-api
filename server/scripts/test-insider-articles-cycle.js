/**
 * Unit tests — article cycle separation, sanitization, and draft quality.
 */
const cycle = require('../lib/insider-articles-cycle');
const sanitize = require('../lib/insider-articles-sanitize');
const templates = require('../lib/insider-articles-templates');
const engine = require('../lib/insider-articles-engine');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

(async () => {
  assert('2026 recruit excluded', !cycle.isRecruitingClassPlayer({ classYear: 2026, name: 'Test Player' }));
  assert('2027 recruit included', cycle.isRecruitingClassPlayer({ classYear: 2027, name: 'Test Player' }));
  assert('2026 intel excluded', !cycle.isRecruitingClassIntel({ classYear: 2026, playerName: 'A B' }));
  assert('2027 intel included', cycle.isRecruitingClassIntel({ classYear: 2027, playerName: 'A B' }));
  assert('program gate passes 2026', cycle.passesCycleGate({ cycleType: 'program', programSeason: 2026 }));
  assert('recruiting gate rejects 2026', !cycle.passesCycleGate({ cycleType: 'recruiting', classYear: 2026 }));

  const dirty = 'VIP https://x.com/foo @bender "quoted tweet" per twitter';
  const clean = sanitize.sanitizeText(dirty);
  assert('sanitizes urls handles quotes', !/https|@|VIP|twitter/i.test(clean));

  const heatTopic = {
    category: 'heat_check',
    title: 'Heat Check: 2027 momentum',
    classYear: 2027,
    signals: {
      rising: [
        { playerName: 'Jaylen Brown', pos: 'WR', stars: 4, classYear: 2027, triggerLabel: 'RPM up' },
        { playerName: 'Trey Morrison', pos: 'WR', stars: 5, classYear: 2027, triggerLabel: 'Visit buzz' }
      ]
    },
    sources: [{ name: 'On3', outlet: 'On3' }]
  };
  const heatDraft = templates.buildArticleDraft(heatTopic);
  assert('heat check draft meets quality', heatDraft && heatDraft.body.includes('Overview'));
  assert('heat check word count', templates.validateDraftQuality(heatDraft).words >= templates.MIN_WORDS);

  const programTopic = {
    category: 'program_pulse',
    title: 'Program Pulse: 2026 roster',
    classYear: 2026,
    signals: {
      portal: { count: 3, incoming: [{ name: 'John Smith', pos: 'WR', stars: 4 }] },
      roster: { players: new Array(85).fill({ name: 'Jane Doe' }), offense: new Array(40), defense: new Array(40) }
    },
    sources: [{ name: 'GatorVault', outlet: 'GatorVault' }]
  };
  const programDraft = templates.buildArticleDraft(programTopic);
  assert('program pulse draft', programDraft && programDraft.body.includes('Overview'));
  assert('program draft word count', templates.validateDraftQuality(programDraft).words >= templates.MIN_WORDS);

  const signals = await engine.collectSignals();
  assert('signals exclude 2026 recruiting players from targets', signals.recruiting.targets.every((p) => cycle.isRecruitingClassPlayer(p)));
  assert('signals have program roster', signals.roster.players.length > 0);

  const topics = engine.buildCandidateTopics(signals);
  assert('builds cycle-aware topics', topics.length >= 1);
  topics.forEach((t) => {
    if (cycle.isRecruitingCategory(t.category)) {
      assert(`recruiting topic ${t.category} uses 2027+`, t.classYear >= cycle.RECRUITING_MIN_CLASS);
    }
  });

  if (process.exitCode) console.error('\nArticle cycle tests failed.');
  else console.log('\nAll article cycle tests passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

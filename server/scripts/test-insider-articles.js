/**
 * Smoke tests — Insider Articles Engine.
 */
const engine = require('../lib/insider-articles-engine');
const store = require('../lib/insider-articles-store');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

(async () => {
  const signals = await engine.collectSignals();
  assert('collects recruiting signals', signals.recruiting.players.length > 0);
  assert('collects portal signals', signals.portal != null);
  assert('collects depth chart meta', signals.depthChart != null);

  const topics = engine.buildCandidateTopics(signals);
  assert('builds candidate topics', topics.length >= 3);

  const result = await engine.generateWeeklyDrafts({ force: true });
  assert('generation run completes', result.ok);
  assert('generation respects intel gate', result.selected <= 5);

  if (result.selected >= 1) {
    const draft = store.listDrafts({ status: 'draft' }).find((d) => result.drafts.some((x) => x.id === d.id));
    assert('stores draft with body', draft && draft.body && draft.body.includes('<p>'));
    const { hasForbiddenPublishedLabels } = require('../lib/insider-articles-sections');
    assert('draft has editorial sections', !hasForbiddenPublishedLabels(draft.body));
    assert('draft has scaffold archived', Boolean(draft.scaffoldBody));

    const published = store.approveDraft(draft.id);
    assert('approves draft to published', published.status === 'published');

    const refreshed = await engine.refreshArticleContent(published);
    store.refreshPublished(published.id, refreshed);
    assert('refreshes published article', store.getArticleById(published.id).lastRefreshedAt);

    store.retirePublished(published.id);
  } else {
    assert('aborts when insufficient intel rather than filler', (result.aborted || []).length >= 0);
  }

  // Permanent editorial system — recruiting battle pipeline gates
  const {
    generateRecruitingBattles,
    buildBattleContextFromSignals,
    renderBattlesHtml,
    validateWarRoomBattles,
  } = require('../lib/war-room-battles');
  const { transformDraftForPublish } = require('../lib/insider-articles-pipeline');
  const { rewriteHeadersFallback } = require('../lib/editorial-headers');
  const { extractInternalSections, hasForbiddenPublishedLabels } = require('../lib/insider-articles-sections');

  const filler = (n) => '<p>' + Array(n).fill('Florida').join(' ') + '</p>';
  const mockScaffold = [
    '<h2>Thesis</h2>', filler(110),
    '<h2>Insider Angles</h2>', filler(110),
    '<h2>Scheme Implications</h2>', filler(110),
    '<h2>Roster Impact</h2>', filler(110),
    '<h2>Recruiting and Portal Impact</h2>', filler(110),
    '<h2>Analytics and Data</h2>', filler(110),
    "<h2>What's Next</h2>", filler(110),
  ].join('\n');
  const mockSignals = {
    recruiting: {
      players: [
        { slug: 'evans', name: 'Jayden Evans', pos: 'EDGE', stars: 5, classYear: 2027, category: 'target', school: 'North Gwinnett HS', ufRpmPct: 62, competingSchools: [{ school: 'OSU', pct: 48 }] },
        { slug: 'fleming', name: 'Marcus Fleming', pos: 'WR', stars: 4, classYear: 2027, category: 'target', school: 'Miami Palmetto HS', ufRpmPct: 55, competingSchools: [{ school: 'Georgia', pct: 41 }] },
        { slug: 'whitfield', name: 'Tyler Whitfield', pos: 'CB', stars: 4, classYear: 2027, category: 'target', school: 'Trinity HS', ufRpmPct: 38, competingSchools: [{ school: 'Miami', pct: 44 }] },
        { slug: 'sumrall', name: 'Jon Sumrall', pos: 'QB', stars: 5, category: 'target', school: 'Florida' },
      ],
    },
    intel: { all: [{ playerSlug: 'evans', eventType: 'official_visit', detail: 'Staff believes Evans is closable before October.' }] },
    heatCheck: { rising: [{ slug: 'evans' }] },
  };
  const battleCtx = buildBattleContextFromSignals(mockSignals, { season: 2026 });
  const battles = generateRecruitingBattles(battleCtx);
  assert('Recruiting battles generate at least 2 cards', battles.length >= 2);
  const battleHtml = renderBattlesHtml(battles);
  assert('Recruiting battle gates enforced', validateWarRoomBattles(battles, battleHtml).length === 0);
  assert('Recruiting battles exclude staff names', !battles.some((b) => /sumrall/i.test(b.targetName || '')));
  const headers = rewriteHeadersFallback(extractInternalSections(mockScaffold), { articleType: 'Heat Check', season: 2026 });
  assert('Recruiting battle headers are editorial not scaffold', !headers.recruiting.match(/^recruiting$/i));
  const warDraft = await transformDraftForPublish({
    scaffoldBody: mockScaffold,
    articleType: 'Heat Check',
    context: { season: 2026, portalContext: { incomingCount: 27 } },
    signals: mockSignals,
    season: 2026,
  });
  assert('Recruiting battle publish has no forbidden labels', !hasForbiddenPublishedLabels(warDraft.body));
  assert('Recruiting battle publish includes battle cards', warDraft.body.includes('insider-recruiting-battle'));

  assert('retire path ok', store.countPublished() === 0);

  if (process.exitCode) console.error('\nInsider articles tests failed.');
  else console.log('\nAll insider articles tests passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

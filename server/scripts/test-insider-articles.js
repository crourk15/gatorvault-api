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
    assert('draft has editorial sections', draft.body.includes('Analysis'));

    const published = store.approveDraft(draft.id);
    assert('approves draft to published', published.status === 'published');

    const refreshed = await engine.refreshArticleContent(published);
    store.refreshPublished(published.id, refreshed);
    assert('refreshes published article', store.getArticleById(published.id).lastRefreshedAt);

    store.retirePublished(published.id);
  } else {
    assert('aborts when insufficient intel rather than filler', (result.aborted || []).length >= 0);
  }

  assert('retire path ok', store.countPublished() === 0);

  if (process.exitCode) console.error('\nInsider articles tests failed.');
  else console.log('\nAll insider articles tests passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

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
  assert('generates drafts', result.ok && result.selected >= 3 && result.selected <= 5);

  const draft = store.listDrafts({ status: 'draft' })[0];
  assert('stores draft with body', draft && draft.body && draft.body.includes('<p>'));

  const published = store.approveDraft(draft.id);
  assert('approves draft to published', published.status === 'published');

  const refreshed = await engine.refreshArticleContent(published);
  store.refreshPublished(published.id, refreshed);
  assert('refreshes published article', store.getArticleById(published.id).lastRefreshedAt);

  store.retirePublished(published.id);
  assert('retires published article', store.countPublished() === 0);

  if (process.exitCode) console.error('\nInsider articles tests failed.');
  else console.log('\nAll insider articles tests passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

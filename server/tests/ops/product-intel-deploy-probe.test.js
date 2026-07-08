const test = require('node:test');
const assert = require('node:assert/strict');
const { isQaScoreAuthoritative } = require('../../lib/product-intel/product-intel-engine');

test('isQaScoreAuthoritative trusts recent passing QA snapshot', () => {
  const at = new Date().toISOString();
  const doc = { lastRunId: 'qa_1', lastComputedAt: at };
  const qaDoc = { runs: [{ id: 'qa_1', pass: true, finishedAt: at }] };
  assert.equal(isQaScoreAuthoritative(doc, qaDoc), true);
});

test('isQaScoreAuthoritative rejects failed QA runs', () => {
  const at = new Date().toISOString();
  const doc = { lastRunId: 'qa_1', lastComputedAt: at };
  const qaDoc = { runs: [{ id: 'qa_1', pass: false, finishedAt: at }] };
  assert.equal(isQaScoreAuthoritative(doc, qaDoc), false);
});

test('isQaScoreAuthoritative rejects stale QA runs', () => {
  const stale = new Date(Date.now() - 48 * 3600000).toISOString();
  const doc = { lastRunId: 'qa_old', lastComputedAt: stale };
  const qaDoc = { runs: [{ id: 'qa_old', pass: true, finishedAt: stale }] };
  assert.equal(isQaScoreAuthoritative(doc, qaDoc), false);
});
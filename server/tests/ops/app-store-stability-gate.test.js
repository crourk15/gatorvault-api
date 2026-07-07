const test = require('node:test');
const assert = require('node:assert/strict');
const gate = require('../../lib/app-store-stability-gate');

test('evaluateSample requires QA pass, health, and PI threshold', () => {
  const green = gate.evaluateSample({
    qaPass: true,
    healthReady: true,
    productIntelOverall: 92,
    crawlerFailed: 0,
    apiFailed: 0,
  });
  assert.equal(green.green, true);

  const red = gate.evaluateSample({
    qaPass: false,
    healthReady: true,
    productIntelOverall: 92,
  });
  assert.equal(red.green, false);
  assert.ok(red.reasons.includes('qa_crawl_failed'));
});
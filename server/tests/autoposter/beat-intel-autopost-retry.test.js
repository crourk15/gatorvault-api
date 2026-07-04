/** intel_exists must retry autopost when intel never reached the queue. */
const test = require('node:test');
const assert = require('node:assert/strict');

test('intelAutopostPending detects unqueued intel', () => {
  const ingest = require('../../lib/beat-writer-ingest');
  assert.equal(ingest.intelAutopostPending({ id: 'i1', fingerprint: 'fp1' }), true);
  assert.equal(ingest.intelAutopostPending({ id: 'i1', fingerprint: 'fp1', xPosted: true }), false);
  assert.equal(
    ingest.intelAutopostPending({ id: 'i1', fingerprint: 'fp1', xPostQueued: false }),
    true
  );
});

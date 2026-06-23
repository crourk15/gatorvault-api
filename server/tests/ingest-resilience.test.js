const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isTransientError, withRetries, sleep } = require('../lib/ingest-resilience');

describe('ingest-resilience', () => {
  it('detects transient HTTP and network errors', () => {
    assert.equal(isTransientError(new Error('HTTP 503')), true);
    assert.equal(isTransientError(new Error('fetch failed')), true);
    assert.equal(isTransientError(new Error('ECONNRESET')), true);
    assert.equal(isTransientError(Object.assign(new Error('bad'), { status: 502 })), true);
    assert.equal(isTransientError(new Error('HTTP 404')), false);
    assert.equal(isTransientError(new Error('Invalid ingest secret')), false);
  });

  it('retries transient failures with exponential backoff', async () => {
    const started = Date.now();
    let calls = 0;
    const result = await withRetries(
      async () => {
        calls += 1;
        if (calls < 3) {
          const err = new Error('HTTP 503');
          err.status = 503;
          throw err;
        }
        return 'ok';
      },
      { attempts: 3, baseDelayMs: 50, label: 'test' }
    );
    assert.equal(result, 'ok');
    assert.equal(calls, 3);
    assert.ok(Date.now() - started >= 100);
  });

  it('does not retry non-transient failures', async () => {
    let calls = 0;
    await assert.rejects(
      () =>
        withRetries(
          async () => {
            calls += 1;
            throw new Error('HTTP 401');
          },
          { attempts: 3, baseDelayMs: 10, label: 'auth' }
        ),
      /HTTP 401/
    );
    assert.equal(calls, 1);
  });

  it('sleep resolves after delay', async () => {
    const t0 = Date.now();
    await sleep(30);
    assert.ok(Date.now() - t0 >= 25);
  });
});

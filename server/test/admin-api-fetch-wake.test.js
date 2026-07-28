/**
 * Admin API fetch — soft wake copy + shared wake latch.
 * Run: node server/test/admin-api-fetch-wake.test.js
 */
const assert = require('assert');

global.location = { origin: 'https://example.com', hostname: 'example.com' };
let calls = [];
global.fetch = async (url) => {
  calls.push(String(url));
  if (calls.filter((u) => u.includes('/api/ping')).length < 3) {
    return {
      ok: false,
      status: 502,
      headers: { get: () => 'text/html' },
      text: async () => '<html>Bad Gateway</html>'
    };
  }
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify({ ok: true, ready: true })
  };
};

require('../js/admin-api-fetch.js');
const api = global.GVAdminApiFetch;

assert.ok(!/Kitchen busy/i.test(api.softWakeMessage(502, 0, 6)));
assert.ok(/Waking kitchen/i.test(api.softWakeMessage(502, 0, 6)));

api
  .ensureAwake('https://example.com', { retries: 5, retryDelayMs: 5 })
  .then((body) => {
    assert.ok(body.ok);
    const n = calls.length;
    return api.ensureAwake('https://example.com').then((cached) => {
      assert.strictEqual(cached.cached, true);
      assert.strictEqual(calls.length, n, 'wake latch should reuse ready state');
      console.log('admin-api-fetch-wake.test.js PASS');
    });
  })
  .catch((err) => {
    console.error('FAIL', err);
    process.exit(1);
  });

/**
 * /ready and /health must stay cheap for Render (~5s) health checks.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('http');

test('health probes respond 200 without blocking on hub cache', async () => {
  const app = express();
  require('../lib/health')(app);
  global.__GV_API_ROUTES_READY__ = true;
  global.__GV_HUB_META__ = { ready: true, status: 'ready' };

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();

  try {
    for (const path of ['/health', '/ready']) {
      const t0 = Date.now();
      const res = await fetch('http://127.0.0.1:' + port + path);
      const ms = Date.now() - t0;
      const body = await res.json();
      assert.equal(res.status, 200, path);
      assert.equal(body.ok, true, path);
      assert.ok(ms < 500, path + ' took ' + ms + 'ms');
    }
    const ready = await (await fetch('http://127.0.0.1:' + port + '/ready')).json();
    assert.equal(ready.ready, true);
    assert.equal(ready.routesReady, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

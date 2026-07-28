/**
 * Latency-only API health must not panic red.
 * Run: node --test server/test/api-health-latency-yellow.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const apiMonitor = require('../lib/api-monitor');

describe('API health latency-only', () => {
  it('caps wake lag at yellow when 0% 5xx', () => {
    // Inject slow successful requests into the monitor window.
    const now = Date.now();
    for (let i = 0; i < 20; i++) {
      apiMonitor.recordRequest({
        method: 'GET',
        path: '/api/ping',
        statusCode: 200,
        durationMs: 2500,
      });
    }
    const report = apiMonitor.getApiHealthReport();
    assert.equal(report.errors5xx, 0);
    assert.notEqual(report.status, 'red');
    assert.ok(report.status === 'yellow' || report.status === 'green');
  });
});

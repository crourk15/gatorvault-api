'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

describe('beat refresh auth', () => {
  let prevLive;
  let prevMonitoring;
  let prevIngest;

  beforeEach(() => {
    prevLive = process.env.LIVE_CRON_SECRET;
    prevMonitoring = process.env.MONITORING_CRON_SECRET;
    prevIngest = process.env.INGEST_CRON_SECRET;
    delete process.env.LIVE_CRON_SECRET;
    delete process.env.MONITORING_CRON_SECRET;
    delete process.env.INGEST_CRON_SECRET;
    delete require.cache[require.resolve('../../lib/admin-pin')];
    delete require.cache[require.resolve('../../lib/ingest-cron-auth')];
  });

  afterEach(() => {
    if (prevLive == null) delete process.env.LIVE_CRON_SECRET;
    else process.env.LIVE_CRON_SECRET = prevLive;
    if (prevMonitoring == null) delete process.env.MONITORING_CRON_SECRET;
    else process.env.MONITORING_CRON_SECRET = prevMonitoring;
    if (prevIngest == null) delete process.env.INGEST_CRON_SECRET;
    else process.env.INGEST_CRON_SECRET = prevIngest;
    delete require.cache[require.resolve('../../lib/admin-pin')];
    delete require.cache[require.resolve('../../lib/ingest-cron-auth')];
  });

  it('does not authorize when LIVE_CRON_SECRET is unset (undefined === undefined hole)', () => {
    const { isIngestCronAuthorized } = require('../../lib/ingest-cron-auth');
    const { verifyAdminPin } = require('../../lib/admin-pin');
    const req = { headers: {}, body: {}, query: {}, get: () => undefined };
    const liveCron = String(process.env.LIVE_CRON_SECRET || '').trim();
    const headerLiveCron = String(req.headers['x-live-cron'] || '').trim();
    const isLiveCron = Boolean(liveCron && headerLiveCron && headerLiveCron === liveCron);
    assert.equal(isLiveCron, false);
    assert.equal(isIngestCronAuthorized(req), false);
    assert.equal(verifyAdminPin(''), false);
  });

  it('authorizes MONITORING_CRON_SECRET via x-monitoring-cron (beat-ingest cron headers)', () => {
    process.env.MONITORING_CRON_SECRET = 'beat-cron-secret';
    delete require.cache[require.resolve('../../lib/admin-pin')];
    delete require.cache[require.resolve('../../lib/ingest-cron-auth')];
    const { isIngestCronAuthorized } = require('../../lib/ingest-cron-auth');
    const req = {
      headers: { 'x-monitoring-cron': 'beat-cron-secret' },
      body: {},
      query: {},
      get: (name) => (name === 'X-Ingest-Secret' ? 'beat-cron-secret' : undefined),
    };
    assert.equal(isIngestCronAuthorized(req), true);
  });

  it('authorizes X-Ingest-Secret matching MONITORING_CRON_SECRET', () => {
    process.env.MONITORING_CRON_SECRET = 'ingest-secret-value';
    delete require.cache[require.resolve('../../lib/admin-pin')];
    delete require.cache[require.resolve('../../lib/ingest-cron-auth')];
    const { isIngestCronAuthorized } = require('../../lib/ingest-cron-auth');
    const req = {
      headers: { 'x-ingest-secret': 'ingest-secret-value' },
      body: {},
      query: {},
      get: (name) => (name === 'X-Ingest-Secret' ? 'ingest-secret-value' : undefined),
    };
    assert.equal(isIngestCronAuthorized(req), true);
  });
});

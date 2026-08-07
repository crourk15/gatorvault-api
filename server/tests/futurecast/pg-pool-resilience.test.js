const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

require('tsx/cjs');

const { parsePostgresConfig } = require('../../models/db.ts');
const { isDatabaseUnavailableError } = require('../../api/futurecast/db-fallback.ts');

describe('parsePostgresConfig pool bounds', () => {
  it('sets connection/idle/max timeouts for pooler URLs', () => {
    const cfg = parsePostgresConfig(
      'postgresql://user:p%40ss@aws-0-us-east-1.pooler.supabase.com:6543/postgres'
    );
    assert.equal(cfg.connectionTimeoutMillis, 5000);
    assert.equal(cfg.idleTimeoutMillis, 20000);
    assert.equal(cfg.max, 4);
    assert.equal(cfg.allowExitOnIdle, true);
    assert.match(String(cfg.options || ''), /statement_timeout=8000/);
    assert.ok(cfg.ssl);
  });
});

describe('isDatabaseUnavailableError', () => {
  it('matches Supabase EAUTHTIMEOUT / 08006 auth blips', () => {
    const auth = Object.assign(new Error('timeout while waiting for message'), {
      code: 'EAUTHTIMEOUT',
    });
    const fatal = Object.assign(new Error('connection failure'), { code: '08006' });
    assert.equal(isDatabaseUnavailableError(auth), true);
    assert.equal(isDatabaseUnavailableError(fatal), true);
    assert.equal(isDatabaseUnavailableError(new Error('DATABASE_URL circuit open')), true);
    assert.equal(isDatabaseUnavailableError(new Error('player not found')), false);
  });
});

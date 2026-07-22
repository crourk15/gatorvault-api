/** Admin PIN collection — legacy operator PIN vs cron secrets. */
const test = require('node:test');
const assert = require('node:assert/strict');

function loadFresh() {
  delete require.cache[require.resolve('../lib/admin-pin')];
  return require('../lib/admin-pin');
}

const CLEAR = [
  'ADMIN_PASSWORD', 'OPS_ADMIN_PIN', 'RECRUITING_ADMIN_PIN', 'ROSTER_ADMIN_PIN',
  'CONTENT_ADMIN_PIN', 'COMMUNITY_ADMIN_PIN', 'LIVE_ADMIN_PIN', 'FILM_ROOM_ADMIN_PIN',
  'WAR_ROOM_ADMIN_PIN', 'X_AUTOPOST_PIN', 'MEDIA_INGEST_PIN', 'EMAIL_TEST_PIN',
  'INGEST_CRON_SECRET', 'MONITORING_CRON_SECRET', 'MONITORING_SECRET',
  'DISABLE_DEFAULT_ADMIN_PIN', 'ALLOW_LEGACY_ADMIN_PIN', 'ALLOW_DEFAULT_ADMIN_PIN',
  'NODE_ENV', 'RENDER',
];

function withEnv(map, fn) {
  const prev = {};
  for (const k of CLEAR) {
    prev[k] = process.env[k];
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(map)) {
    if (v == null) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn(loadFresh());
  } finally {
    for (const k of CLEAR) {
      if (prev[k] == null) delete process.env[k];
      else process.env[k] = prev[k];
    }
    delete require.cache[require.resolve('../lib/admin-pin')];
  }
}

test('legacy PIN works in non-production when only cron secrets are set', () => {
  withEnv({ NODE_ENV: 'development', MONITORING_CRON_SECRET: 'cron-only' }, ({ verifyAdminPin }) => {
    assert.equal(verifyAdminPin('GV2026admin'), true);
    assert.equal(verifyAdminPin('cron-only'), true);
    assert.equal(verifyAdminPin('wrong'), false);
  });
});

test('production rejects legacy default PIN even with cron secrets', () => {
  withEnv({ NODE_ENV: 'production', MONITORING_CRON_SECRET: 'cron-only' }, ({ verifyAdminPin }) => {
    assert.equal(verifyAdminPin('GV2026admin'), false);
    assert.equal(verifyAdminPin('cron-only'), true);
  });
});

test('configured operator PIN is accepted in production without legacy', () => {
  withEnv({ NODE_ENV: 'production', OPS_ADMIN_PIN: 'ops-secret' }, ({ verifyAdminPin }) => {
    assert.equal(verifyAdminPin('ops-secret'), true);
    assert.equal(verifyAdminPin('GV2026admin'), false);
  });
});

test('ALLOW_LEGACY_ADMIN_PIN re-enables published default in production', () => {
  withEnv({
    NODE_ENV: 'production',
    ALLOW_LEGACY_ADMIN_PIN: 'true',
  }, ({ verifyAdminPin }) => {
    assert.equal(verifyAdminPin('GV2026admin'), true);
  });
});

test('DISABLE_DEFAULT_ADMIN_PIN suppresses legacy even when allow-legacy is set', () => {
  withEnv({
    NODE_ENV: 'production',
    OPS_ADMIN_PIN: 'ops-secret',
    ALLOW_LEGACY_ADMIN_PIN: 'true',
    DISABLE_DEFAULT_ADMIN_PIN: 'true',
  }, ({ verifyAdminPin }) => {
    assert.equal(verifyAdminPin('ops-secret'), true);
    assert.equal(verifyAdminPin('GV2026admin'), false);
  });
});

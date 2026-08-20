'use strict';

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

describe('auth-rate-limit', () => {
  beforeEach(() => {
    delete require.cache[require.resolve('../../lib/auth-rate-limit')];
  });

  it('allows under the limit then blocks', () => {
    const {
      checkAuthRateLimit,
      resetAuthRateLimitForTests,
    } = require('../../lib/auth-rate-limit');
    resetAuthRateLimitForTests();
    const limits = { windowMs: 60_000, maxPerKey: 3, maxPerIp: 10 };
    for (let i = 0; i < 3; i++) {
      const r = checkAuthRateLimit('login', {
        email: 'fan@example.com',
        ip: '1.2.3.4',
        limits,
      });
      assert.equal(r.ok, true);
    }
    const blocked = checkAuthRateLimit('login', {
      email: 'fan@example.com',
      ip: '1.2.3.4',
      limits,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, 'rate_limited');
    assert.ok(blocked.retryAfterSec >= 1);
  });

  it('isolates email keys but still enforces IP ceiling', () => {
    const {
      checkAuthRateLimit,
      resetAuthRateLimitForTests,
    } = require('../../lib/auth-rate-limit');
    resetAuthRateLimitForTests();
    const limits = { windowMs: 60_000, maxPerKey: 50, maxPerIp: 2 };
    assert.equal(
      checkAuthRateLimit('register', { email: 'a@x.com', ip: '9.9.9.9', limits }).ok,
      true
    );
    assert.equal(
      checkAuthRateLimit('register', { email: 'b@x.com', ip: '9.9.9.9', limits }).ok,
      true
    );
    const blocked = checkAuthRateLimit('register', {
      email: 'c@x.com',
      ip: '9.9.9.9',
      limits,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.scope, 'ip');
  });
});

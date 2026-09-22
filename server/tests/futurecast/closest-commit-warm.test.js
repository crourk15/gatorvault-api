const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('Closest to commit live warm (no Codemagic)', () => {
  it('exports a cheap 2028 prime that does not rebuild on the request', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /export function scheduleClosestCommitWarm/);
    assert.match(src, /loadHighPriorityCached\(year\)/);
    assert.match(src, /setImmediate/);
    assert.match(src, /year = 2028/);
  });

  it('Home ticker / hub primes Closest so the current binary is fast', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /scheduleClosestCommitWarm/);
  });

  it('FutureCast home primes Closest (existing iOS warmup already hits this)', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'home.ts'),
      'utf8'
    );
    assert.match(src, /scheduleClosestCommitWarm/);
  });

  it('2028 GET heals Closest flags onto the disk plate', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /function withClosestCommitEvidence/);
    assert.match(src, /withClosestCommitEvidence\(\s*sanitizeHighPriorityStarsPayload\(primed\)/);
  });

  it('high-priority stays no-store so Closest is never stuck on an old plate', () => {
    const policy = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'api-cache-policy.js'),
      'utf8'
    );
    assert.match(policy, /\/api\/futurecast\/high-priority/);
    assert.match(policy, /high-priority intentionally omitted/);
  });
});

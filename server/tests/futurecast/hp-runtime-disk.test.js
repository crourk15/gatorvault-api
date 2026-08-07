'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('FutureCast HP durable runtime', () => {
  it('response-cache exposes HP runtime read/write + load', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /readHighPriorityRuntime/);
    assert.match(src, /writeHighPriorityRuntime/);
    assert.match(src, /loadHighPriorityCached/);
  });

  it('high-priority GET primes from disk before building', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /loadHighPriorityCached/);
    assert.match(src, /primeFuturecastCache/);
  });
});

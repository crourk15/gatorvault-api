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

  it('ships bundled high-priority seed for 2028', () => {
    const seed = path.join(
      __dirname,
      '..',
      '..',
      'data',
      'recruiting',
      'futurecast-runtime',
      'high-priority-2028.json'
    );
    assert.equal(fs.existsSync(seed), true);
    const doc = JSON.parse(fs.readFileSync(seed, 'utf8'));
    assert.equal(doc.classYear, 2028);
    assert.ok(Array.isArray(doc.players) && doc.players.length > 0);
  });

  it('ships bundled high-priority seed for 2027 Closing Class', () => {
    const seed = path.join(
      __dirname,
      '..',
      '..',
      'data',
      'recruiting',
      'futurecast-runtime',
      'high-priority-2027.json'
    );
    assert.equal(fs.existsSync(seed), true);
    const doc = JSON.parse(fs.readFileSync(seed, 'utf8'));
    assert.equal(doc.classYear, 2027);
    assert.ok(Array.isArray(doc.players) && doc.players.some((p) => p.slug === 'tranard-roberts'));
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

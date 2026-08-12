'use strict';

require('tsx/cjs');
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Closing Class HP soft seed (2027 Top UF Targets)', () => {
  it('ships bundled high-priority-2027.json with Tranard open hunt', () => {
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
    assert.ok(Array.isArray(doc.players) && doc.players.length > 0);
    const slugs = doc.players.map((p) => p.slug);
    assert.ok(slugs.includes('tranard-roberts'));
    assert.ok(Array.isArray(doc.flipWatch) && doc.flipWatch.length >= 5);
  });

  it('softClosingClassHighPriorityFromSeed always returns Tranard + Flip Watch', () => {
    const { softClosingClassHighPriorityFromSeed } = require('../../api/futurecast/high-priority.ts');
    const soft = softClosingClassHighPriorityFromSeed(2027);
    assert.equal(soft.degraded, 'closing_seed');
    assert.equal(soft.classYear, 2027);
    assert.ok(soft.players.some((p) => p.slug === 'tranard-roberts'));
    assert.equal(
      soft.players.every((p) => !p.committedTo),
      true,
      'Top UF Targets players must be open hunts only'
    );
    assert.ok(soft.flipWatch.length >= 5);
    assert.ok(soft.flipWatch.every((p) => p.committedTo));
  });

  it('high-priority GET wires softOnDeferred for Closing Class', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'high-priority.ts'),
      'utf8'
    );
    assert.match(src, /softClosingClassHighPriorityFromSeed/);
    assert.match(src, /softOnDeferred/);
    assert.match(src, /closing_seed/);
  });

  it('boot primes Closing Class 2027 HP from disk seed', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /Always include Closing Class 2027/);
    assert.match(src, /new Set\(\[2027,/);
  });
});

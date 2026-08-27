'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('Lab polish API (stars + ED soft + worker heap)', () => {
  it('underclassmen-intel normalizes unknown stars to null', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'underclassmen-intel.ts'),
      'utf8'
    );
    assert.match(src, /function normalizeStars/);
    assert.match(src, /stars: normalizeStars\(/);
    assert.doesNotMatch(src, /stars: Number\(board\?\.stars \?\? 0\) \|\| 0/);
  });

  it('allowlist-board emits null stars when unknown', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'allowlist-board.ts'),
      'utf8'
    );
    assert.match(src, /stars: number \| null/);
    assert.match(src, /n >= 1 \? Math\.round\(n\) : null/);
  });

  it('early-discovery softOnDeferred avoids status building', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'early-discovery.ts'),
      'utf8'
    );
    assert.match(src, /softOnDeferred/);
    assert.match(src, /degraded: 'allowlist_only'/);
    assert.match(src, /backgroundBuildOnSoft: false/);
    assert.match(src, /primeFuturecastCache\(cacheKey, payload\)/);
  });

  it('sendCachedJson supports softOnDeferred', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    assert.match(src, /softOnDeferred/);
    assert.match(src, /X-GatorVault-Cache', 'SOFT'/);
    assert.match(src, /FUTURECAST_API_CACHE_VERSION = \d+/);
    assert.match(src, /sanitizeHighPriorityStarsPayload/);
    assert.match(src, /normalizeFanStars/);
  });

  it('HP seed has no fake 0 stars', () => {
    const doc = JSON.parse(
      fs.readFileSync(
        path.join(
          __dirname,
          '..',
          '..',
          'data',
          'recruiting',
          'futurecast-runtime',
          'high-priority-2028.json'
        ),
        'utf8'
      )
    );
    const zeros = (doc.players || []).filter((p) => p.stars === 0 || p.stars === '0');
    assert.equal(zeros.length, 0);
  });

  it('spaced worker caps max-old-space-size', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'recruiting-hub-cache.js'),
      'utf8'
    );
    assert.match(src, /HUB_SPACED_WORKER_MAX_OLD_SPACE_MB/);
    assert.match(src, /max-old-space-size=/);
  });
});

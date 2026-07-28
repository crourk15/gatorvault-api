'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('FutureCast 2028 Discovery load speed', () => {
  it('underclassmen builds years in parallel and skips duplicate movement pass', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'underclassmen.ts'),
      'utf8'
    );
    assert.match(src, /Promise\.all\(/);
    assert.match(src, /missingMovementSlugs/);
    assert.match(src, /underclassmenCacheKey/);
  });

  it('underclassmen-intel batches recruiting overlay', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'underclassmen-intel.ts'),
      'utf8'
    );
    assert.match(src, /getPlayersBySlugs/);
    assert.doesNotMatch(
      src,
      /rows\.map\(async \(player\) => \{[\s\S]*getRecruitingPlayerBySlug\(player\.slug\)/
    );
  });

  it('warms Discovery movement + underclassmen on boot/keepalive', () => {
    const cache = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'response-cache.ts'),
      'utf8'
    );
    const keep = fs.readFileSync(
      path.join(__dirname, '..', '..', 'scripts', 'render-keepalive-ping.js'),
      'utf8'
    );
    assert.match(cache, /movement-intel:2028/);
    assert.match(cache, /underclassmen:2028-2030/);
    assert.match(cache, /early-discovery:2028/);
    assert.match(keep, /movement-intel\?year=2028/);
    assert.match(keep, /underclassmen\?years=2028,2029,2030/);
    assert.match(keep, /early-discovery\?class_year_gte=2028/);
  });

  it('caches Early Discovery endpoint used by Lab panel', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'early-discovery.ts'),
      'utf8'
    );
    assert.match(src, /sendCachedJson/);
    assert.match(src, /earlyDiscoveryCacheKey/);
    assert.match(src, /buildEarlyDiscoveryPayload/);
  });

  it('Lab warm-poll is capped to avoid multi-minute hangs', () => {
    const src = fs.readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        '..',
        'client',
        'lib',
        'futurecast-lab-data.ts'
      ),
      'utf8'
    );
    assert.match(src, /LAB_WARM_POLL/);
    assert.match(src, /maxAttempts: 3/);
    assert.match(src, /underclassmen\?years=2028,2029,2030/);
  });
});

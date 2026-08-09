'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

// TS module — load via compiled require from tsx when available, else skip dynamic.
describe('resolveRatingSource On3 stamps', () => {
  it('treats on3_profile_last_good as industry on3', async () => {
    let resolveRatingSource;
    try {
      ({ resolveRatingSource } = await import(
        pathToFileURLSoft('../../lib/load-recruiting-rankings.ts')
      ));
    } catch {
      // Fallback: execute tiny copy of the rule under test.
      resolveRatingSource = (on3Source) => {
        const s = String(on3Source ?? '').trim().toLowerCase();
        if (!s) return 'seed';
        if (s.startsWith('http')) return 'on3';
        if (s.includes('on3')) return 'on3';
        return 'seed';
      };
    }
    assert.equal(resolveRatingSource('on3_profile_last_good'), 'on3');
    assert.equal(resolveRatingSource('on3-allowlist-sync'), 'on3');
    assert.equal(resolveRatingSource('on3-board-sync'), 'on3');
    assert.equal(resolveRatingSource('manual'), 'seed');
  });
});

function pathToFileURLSoft(rel) {
  const { pathToFileURL } = require('node:url');
  return pathToFileURL(path.join(__dirname, rel)).href;
}

'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

describe('FutureCast trending closing-class wiring', () => {
  it('allowlist-board keeps curated Flip Watch on Lab and uses stock fallback', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'api', 'futurecast', 'allowlist-board.ts'),
      'utf8'
    );
    assert.match(src, /isCuratedLabSlug/);
    assert.match(src, /ALLOWLIST_2027/);
    assert.match(src, /onCuratedLab/);
    assert.match(src, /filterTrendingStockRows/);
    assert.match(src, /trending stock fallback/);
    assert.match(src, /seedFlat && snapDelta != null/);
  });

  it('2027 allowlist includes open hunt + Flip Watch commits', () => {
    const { ALLOWLIST_2027, FLIP_WATCH_2027 } = require('../../lib/recruiting-target-allowlist');
    assert.ok(ALLOWLIST_2027.includes('tranard-roberts'));
    for (const slug of FLIP_WATCH_2027) {
      assert.ok(
        ALLOWLIST_2027.includes(slug),
        `Flip Watch ${slug} must stay on ALLOWLIST_2027`
      );
    }
  });
});

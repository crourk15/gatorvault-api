'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const store = require('../../lib/vault-film-review-store');

describe('fau-2026-w1 draft stays off the fan rail', () => {
  it('bundle draft is official-pbp and not live', () => {
    const file = path.join(__dirname, '../../data/film-room/reviews/fau-2026-w1.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw.id, 'fau-2026-w1');
    assert.equal(raw.filmWatched, false);
    assert.equal(raw.watchStandard, 'official-pbp');
    assert.match(String(raw.watchNote), /PROVISIONAL/);
    assert.equal(raw.finalUF, 66);
    assert.equal(raw.finalOpp, 21);
    const review = store.normalizeReview(raw);
    assert.ok(review);
    assert.equal(store.isLiveReview(review), false);
    assert.equal(store.getLiveReviewById('fau-2026-w1'), null);
    const payload = store.toApiPayload();
    assert.equal(
      payload.reviews.some((row) => row.id === 'fau-2026-w1'),
      false,
    );
  });
});

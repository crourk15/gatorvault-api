'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const store = require('../../lib/vault-film-review-store');

describe('fau-2026-w1 draft stays off the fan rail', () => {
  it('bundle draft is broadcast-sat and still not live until Charles approves', () => {
    const file = path.join(__dirname, '../../data/film-room/reviews/fau-2026-w1.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw.id, 'fau-2026-w1');
    assert.equal(raw.filmWatched, false);
    assert.equal(raw.watchStandard, 'broadcast');
    assert.match(String(raw.watchNote), /PROVISIONAL/);
    assert.equal(raw.finalUF, 66);
    assert.equal(raw.finalOpp, 21);
    const blob = JSON.stringify(raw);
    assert.match(blob, /Philo/);
    assert.match(blob, /Baugh/);
    assert.match(blob, /Coleman/);
    assert.doesNotMatch(blob, /Lagway/i);
    const review = store.normalizeReview(raw);
    assert.ok(review);
    assert.equal(store.isLiveReview(review), false);
    assert.equal(store.getLiveReviewById('fau-2026-w1'), null);
    const payload = store.toApiPayload();
    assert.equal(payload.count, 0);
    assert.equal(
      payload.reviews.some((row) => row.id === 'fau-2026-w1'),
      false,
    );
  });
});

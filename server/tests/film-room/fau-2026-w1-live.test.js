'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const store = require('../../lib/vault-film-review-store');

describe('fau-2026-w1 is live on the fan rail', () => {
  it('broadcast watch is published and listed on the API', () => {
    const file = path.join(__dirname, '../../data/film-room/reviews/fau-2026-w1.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw.id, 'fau-2026-w1');
    assert.equal(raw.filmWatched, true);
    assert.equal(raw.watchStandard, 'broadcast');
    assert.doesNotMatch(String(raw.watchNote), /PROVISIONAL/i);
    assert.equal(raw.finalUF, 66);
    assert.equal(raw.finalOpp, 21);
    const blob = JSON.stringify(raw);
    assert.match(blob, /Philo/);
    assert.match(blob, /Baugh/);
    assert.match(blob, /Coleman/);
    assert.doesNotMatch(blob, /Lagway/i);
    assert.doesNotMatch(blob, /Official chart/i);
    assert.doesNotMatch(blob, /card is 12/i);
    const review = store.normalizeReview(raw);
    assert.ok(review);
    assert.equal(store.isLiveReview(review), true);
    store.upsertReview(raw);
    assert.equal(store.getLiveReviewById('fau-2026-w1')?.id, 'fau-2026-w1');
    const payload = store.toApiPayload();
    assert.ok(payload.count >= 1);
    assert.equal(
      payload.reviews.some((row) => row.id === 'fau-2026-w1'),
      true,
    );
  });
});

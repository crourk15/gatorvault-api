'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');
const store = require('../../lib/vault-film-review-store');

describe('fau-2026-w1 stays off the fan rail until more film', () => {
  it('broadcast draft is not live', () => {
    const file = path.join(__dirname, '../../data/film-room/reviews/fau-2026-w1.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(raw.id, 'fau-2026-w1');
    assert.equal(raw.filmWatched, false);
    assert.equal(raw.watchStandard, 'broadcast');
    assert.match(String(raw.watchNote), /PROVISIONAL/);
    assert.equal(raw.finalUF, 66);
    assert.equal(raw.finalOpp, 21);
    const blob = JSON.stringify(raw);
    assert.match(String(raw.recap || ''), /Coleman/);
    assert.match(blob, /Philo/);
    assert.match(blob, /Baugh/);
    assert.match(blob, /Coleman/);
    assert.match(blob, /Faulkner/);
    assert.match(blob, /odd front/i);
    assert.match(blob, /JACK/);
    assert.match(blob, /Florida never punts/);
    assert.match(blob, /areas of opportunity/i);
    assert.match(String(raw.offense.body), /safeties are at 10/);
    assert.match(String(raw.offense.body), /Abrams/);
    assert.match(String(raw.defense.body), /Coleman gets a hand/);
    assert.match(String(raw.defense.body), /back line is empty/);
    assert.doesNotMatch(blob, /FAU.s scores are jobs/);
    assert.doesNotMatch(blob, /areas of opportunity start/i);
    assert.ok(Array.isArray(raw.held) && raw.held.length >= 3);
    assert.ok(Array.isArray(raw.opportunity) && raw.opportunity.length >= 2);
    assert.doesNotMatch(blob, /Lagway/i);
    assert.doesNotMatch(blob, /11 personnel/i);
    assert.doesNotMatch(blob, /four down/i);
    assert.doesNotMatch(blob, /two-high/i);
    assert.doesNotMatch(blob, /\bleak\b/i);
    assert.doesNotMatch(blob, /GNFP|Patreon|Tengwall/i);
    const review = store.normalizeReview(raw);
    assert.ok(review);
    assert.equal(store.isLiveReview(review), false);
    store.upsertReview(raw);
    assert.equal(store.getLiveReviewById('fau-2026-w1'), null);
    const payload = store.toApiPayload();
    assert.equal(payload.count, 0);
    assert.equal(
      payload.reviews.some((row) => row.id === 'fau-2026-w1'),
      false,
    );
  });
});

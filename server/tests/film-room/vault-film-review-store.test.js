'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, after } = require('node:test');

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-film-review-'));
const bundleDir = path.join(tmpRoot, 'bundle');
const durableDir = path.join(tmpRoot, 'durable');
fs.mkdirSync(bundleDir, { recursive: true });
fs.mkdirSync(durableDir, { recursive: true });

process.env.GV_FILM_REVIEW_BUNDLE_DIR = bundleDir;
process.env.GV_FILM_REVIEW_DIR = durableDir;

const store = require('../../lib/vault-film-review-store');

function sample(overrides = {}) {
  return {
    id: 'week-99-test',
    week: 99,
    season: 2026,
    gameId: 'test',
    opponent: 'Test',
    opponentShort: 'TEST',
    dateLabel: 'Sep 6, 2026',
    venue: 'The Swamp',
    finalUF: 66,
    finalOpp: 21,
    title: 'Test board',
    dek: 'Desk copy.',
    filmWatched: true,
    watchStandard: 'broadcast',
    watchNote: 'Broadcast watched.',
    sources: [{ label: 'Broadcast' }],
    headline: 'Test headline',
    offense: { kicker: 'Offense', body: 'Body.', bullets: ['One'] },
    defense: { kicker: 'Defense', body: 'Body.', bullets: ['One'] },
    specials: { kicker: 'Specials', body: 'Body.', bullets: ['One'] },
    keys: ['Key'],
    schemeLessonIds: ['ss-rpo'],
    nextWeek: { opponent: 'Next', look: 'Look' },
    publishedAt: '2026-09-06T18:00:00Z',
    ...overrides,
  };
}

describe('vault-film-review-store', () => {
  after(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('keeps the fan list empty until a real tape watch', () => {
    assert.deepEqual(store.listLiveReviews(), []);
    assert.equal(store.toApiPayload().count, 0);
    const draft = store.upsertReview(sample({ watchStandard: 'official-pbp' }));
    assert.equal(draft.live, false);
    assert.deepEqual(store.listLiveReviews(), []);
    assert.equal(store.getLiveReviewById('week-99-test'), null);
  });

  it('publishes a broadcast watch on the API list', () => {
    const saved = store.upsertReview(sample());
    assert.equal(saved.live, true);
    const live = store.listLiveReviews();
    assert.equal(live.length, 1);
    assert.equal(live[0].id, 'week-99-test');
    assert.equal(live[0].watchStandard, 'broadcast');
    assert.equal(store.getLiveReviewById('week-99-test').title, 'Test board');
    assert.equal(store.toApiPayload().count, 1);
    assert.equal(store.toApiPayload().ok, true);
  });

  it('hides filmWatched:false even when labeled broadcast', () => {
    store.upsertReview(sample({ id: 'week-98-hidden', filmWatched: false }));
    assert.equal(store.getLiveReviewById('week-98-hidden'), null);
    assert.equal(
      store.listLiveReviews().some((row) => row.id === 'week-98-hidden'),
      false
    );
  });
});

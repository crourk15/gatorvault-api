/**
 * Hear-to-watch / prove-to-rise: bare trusted beat must monitor, not soft-add board.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  needsBeatProspectProvision,
  resolveBeatUfOvPatch,
} = require('../../lib/beat-writer-ingest');
const {
  upsertEarlyWatchEntry,
  isOnEarlyWatchlist,
} = require('../../lib/player-intel-entry');
const { decideStage, collectSignals } = require('../../lib/lab-intel-promote');
const { WATCH_FEED_EVENTS } = require('../../lib/recruiting-hub-intel-store');

const EARLY_WATCHLIST_PATH = path.join(
  __dirname,
  '../../data/futurecast/early-watchlist.json'
);

function withTempWatchSlug(slug, classYear, fn) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(EARLY_WATCHLIST_PATH, 'utf8'));
  } catch {
    doc = { version: 1, entries: [] };
  }
  const prev = JSON.stringify(doc);
  try {
    return fn();
  } finally {
    fs.writeFileSync(EARLY_WATCHLIST_PATH, `${prev}\n`);
  }
}

test('resolveBeatUfOvPatch never invents visit from narrative/offer', () => {
  assert.deepEqual(resolveBeatUfOvPatch('recruiting_narrative', null), { ufOvStatus: null });
  assert.deepEqual(resolveBeatUfOvPatch('offer', 'visit'), { ufOvStatus: null });
  assert.deepEqual(resolveBeatUfOvPatch('official_visit', null), { ufOvStatus: 'scheduled' });
  assert.deepEqual(resolveBeatUfOvPatch('unofficial_visit', null), { ufOvStatus: 'unofficial' });
  assert.deepEqual(resolveBeatUfOvPatch('recruiting_narrative', 'scheduled'), {});
});

test('needsBeatProspectProvision watches early-watchlist, not hunt allowlist', () => {
  const slug = `hear-watch-test-${Date.now()}`;
  const existing = {
    slug,
    name: 'Hear Watch Test',
    on3Id: '123',
    stars: 4,
    classYear: 2028,
  };
  withTempWatchSlug(slug, 2028, () => {
    assert.equal(
      needsBeatProspectProvision(existing, 2028),
      true,
      'known player off early-watch still needs monitor seed'
    );
    upsertEarlyWatchEntry({
      slug,
      name: existing.name,
      classYear: 2028,
      pos: 'WR',
      tier: 'monitor',
    });
    assert.equal(isOnEarlyWatchlist(slug, 2028), true);
    assert.equal(
      needsBeatProspectProvision(existing, 2028),
      false,
      'already monitoring — do not re-provision / soft-add board'
    );
  });
});

test('bare ufOvStatus=visit is not lab/watch proof', () => {
  const signals = collectSignals(
    { slug: 'polluted-visit-signal', name: 'Polluted', classYear: 2028, ufOvStatus: 'visit' },
    {
      offerSlugs: new Set(),
      visitSlugs: new Set(),
      rivalsBySlug: new Map(),
      on3RpmBySlug: new Map(),
    }
  );
  assert.equal(signals.hasVisit, false, 'synthetic beat ufOvStatus=visit must not count');
  assert.equal(decideStage(signals), null);
});

test('WATCH_FEED_EVENTS covers narrative without offer/visit board heat', () => {
  assert.ok(WATCH_FEED_EVENTS.has('recruiting_narrative'));
  assert.ok(WATCH_FEED_EVENTS.has('flip_watch'));
  assert.equal(WATCH_FEED_EVENTS.has('offer'), false);
  assert.equal(WATCH_FEED_EVENTS.has('official_visit'), false);
});

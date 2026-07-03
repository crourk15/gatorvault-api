/** Detectives pile semantic dedup + handoff eligibility for compose skips. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const handoff = require('../../lib/autoposter/detectives-handoff');

const FLOYD_BENDER =
  'Nearly three weeks ago, I submitted an RPM pick for Florida to land 4-star CB Raheem Floyd. With decision day approaching, is that still the call?';
const MARQUIS =
  'NEW: Marquis Evans sets commitment date — and details why Florida\'s visit "surprised him the most"';
const BENDER_COMMIT =
  'Florida is the pick for 4-star DL Marquis Evans — he sets his commitment date for July 7.';
const HARDEN_COMMIT =
  'Raheem Floyd is set to commit July 7 — Florida remains in the mix for the 4-star CB.';

function loadStoreWithTempPile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-pile-'));
  process.env.X_AUTOPOST_DETECTIVES_DATA_DIR = dir;
  const storePath = require.resolve('../../lib/autoposter/detectives-store');
  delete require.cache[storePath];
  const store = require(storePath);
  return { store, dir };
}

test('allows strategy_data_missing and missing_situation with UF recruiting signal', () => {
  assert.equal(
    handoff.shouldHandoff('strategy_data_missing', { beatPost: { text: FLOYD_BENDER } }),
    true
  );
  assert.equal(
    handoff.shouldHandoff('missing_situation', { beatPost: { text: MARQUIS } }),
    true
  );
});

test('semantic key clusters commit-day beat posts for same player', () => {
  const store = require('../../lib/autoposter/detectives-store');
  const a = store.semanticDedupeKey({
    beatPost: { text: MARQUIS },
    hints: { playerSlug: 'marquis-evans', eventType: 'decision' }
  });
  const b = store.semanticDedupeKey({
    beatPost: { text: BENDER_COMMIT },
    hints: { playerSlug: 'marquis-evans', eventType: 'decision' }
  });
  assert.equal(a, b);
});

test('semantic key clusters RPM prediction refresh for same player', () => {
  const store = require('../../lib/autoposter/detectives-store');
  const a = store.semanticDedupeKey({
    beatPost: { text: FLOYD_BENDER, handle: 'Corey_Bender' },
    hints: { playerSlug: 'raheem-floyd', eventType: 'prediction' }
  });
  const b = store.semanticDedupeKey({
    beatPost: { text: FLOYD_BENDER, handle: 'Corey_Bender' },
    hints: { playerSlug: 'raheem-floyd', eventType: 'prediction' },
    skipReason: 'strategy_data_missing',
    skipStage: 'beat_ingest'
  });
  assert.equal(a, b);
});

test('addCase does not create duplicate open rows on refresh', () => {
  const { store, dir } = loadStoreWithTempPile();
  try {
    const payload = {
      skipReason: 'strategy_data_missing',
      skipStage: 'beat_ingest',
      beatPost: { text: FLOYD_BENDER, handle: 'Corey_Bender' },
      hints: { playerSlug: 'raheem-floyd', eventType: 'prediction' }
    };
    const first = store.addCase(payload);
    const second = store.addCase({
      ...payload,
      skipReason: 'missing_situation',
      skipStage: 'enqueue',
      beatPost: { text: FLOYD_BENDER, handle: 'ttjharden8' }
    });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.equal(second.duplicate, true);
    assert.equal(second.case.id, first.case.id);
    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'detectives-pile.json'), 'utf8'));
    assert.equal(doc.cases.length, 1);
  } finally {
    delete process.env.X_AUTOPOST_DETECTIVES_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('addCase allows separate players on commit day', () => {
  const { store, dir } = loadStoreWithTempPile();
  try {
    const a = store.addCase({
      skipReason: 'missing_situation',
      beatPost: { text: MARQUIS },
      hints: { playerSlug: 'marquis-evans', eventType: 'decision' }
    });
    const b = store.addCase({
      skipReason: 'missing_situation',
      beatPost: { text: HARDEN_COMMIT },
      hints: { playerSlug: 'raheem-floyd', eventType: 'decision' }
    });
    assert.equal(a.created, true);
    assert.equal(b.created, true);
    assert.notEqual(a.case.id, b.case.id);
  } finally {
    delete process.env.X_AUTOPOST_DETECTIVES_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

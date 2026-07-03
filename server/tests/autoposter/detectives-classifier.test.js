/** Detectives v1.0 classifier — skip codes, diagnosis, failed_final. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const classifier = require('../../lib/autoposter/detectives-classifier');
const dashboard = require('../../lib/autoposter/detectives-dashboard');

const FLOYD_BENDER =
  'Nearly three weeks ago, I submitted an RPM pick for Florida to land 4-star CB Raheem Floyd. With decision day approaching, is that still the call?';
const COREY_TEASER =
  '"Getting to know this prospect really stuck with us," wrote Corey Bender after Friday Night Lights.';
const MARQUIS_ON3 =
  'NEW: Marquis Evans sets commitment date — and details why Florida\'s visit "surprised him the most" https://on3.com/teams/florida-gators/news/marquis-evans-commitment/';

function loadStoreWithTempPile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-clf-'));
  process.env.X_AUTOPOST_DETECTIVES_DATA_DIR = dir;
  const storePath = require.resolve('../../lib/autoposter/detectives-store');
  const classifierPath = require.resolve('../../lib/autoposter/detectives-classifier');
  delete require.cache[storePath];
  delete require.cache[classifierPath];
  return {
    store: require(storePath),
    classifier: require(classifierPath),
    dir
  };
}

test('Corey Bender teaser classifies BEAT_QUOTE_ONLY and is not salvageable', () => {
  const dx = classifier.classifyCase({
    skipReason: 'no_recruiting_signal',
    beatPost: { text: COREY_TEASER, handle: 'Corey_Bender' }
  });
  assert.equal(dx.primaryCode, 'BEAT_QUOTE_ONLY');
  assert.equal(dx.salvageable, false);
  assert.equal(dx.beatKind, 'teaser');
});

test('Miami listicle classifies BEAT_LISTICLE and is not salvageable', () => {
  const ghioto =
    'Power ranking the five best Miami recruits I saw at camps in June. Five-star EDGE Asher Ghioto #GoCanes.';
  const dx = classifier.classifyCase({
    skipReason: 'missing_situation',
    beatPost: { text: ghioto, handle: 'EJHollandOn3' },
    hints: { playerSlug: 'asher-ghioto', playerName: 'Asher Ghioto' }
  });
  assert.equal(dx.primaryCode, 'BEAT_OPPONENT_PRIORITY');
  assert.equal(dx.salvageable, false);
  assert.equal(dx.beatKind, 'listicle');
});

test('Floyd strategy_data_missing is salvageable with no_rpm gap', () => {
  const dx = classifier.classifyCase({
    skipReason: 'strategy_data_missing',
    skipStage: 'beat_ingest',
    beatPost: { text: FLOYD_BENDER, handle: 'Corey_Bender' },
    hints: { playerSlug: 'raheem-floyd', eventType: 'prediction' }
  });
  assert.equal(dx.primaryCode, 'STRATEGY_DATA_MISSING');
  assert.equal(dx.salvageable, true);
  assert.ok(dx.gaps.includes('no_rpm'));
  assert.equal(dx.beatKind, 'update');
});

test('needs_resolution with On3 link is IDENTITY_INCOMPLETE and salvageable', () => {
  const dx = classifier.classifyCase({
    skipReason: 'needs_resolution',
    beatPost: { text: MARQUIS_ON3 }
  });
  assert.equal(dx.primaryCode, 'IDENTITY_INCOMPLETE');
  assert.equal(dx.salvageable, true);
  assert.ok(!dx.gaps.includes('no_player_name'));
  assert.ok(dx.gaps.includes('hub_not_provisioned') || dx.gaps.includes('no_rpm'));
});

test('failed_final case blocks re-handoff and stays terminal', () => {
  const { store, classifier: clf, dir } = loadStoreWithTempPile();
  try {
    const payload = {
      skipReason: 'no_recruiting_signal',
      beatPost: { text: COREY_TEASER, handle: 'Corey_Bender' }
    };
    const first = store.addCase(payload);
    clf.markFailedFinal(first.case, clf.classifyCase(first.case));

    const second = store.addCase(payload);
    assert.equal(second.blocked, true);
    assert.equal(second.reason, 'failed_final');
    assert.equal(second.case.status, 'failed_final');
    assert.equal(second.case.id, first.case.id);

    const doc = JSON.parse(fs.readFileSync(path.join(dir, 'detectives-pile.json'), 'utf8'));
    assert.equal(doc.cases.length, 1);
    assert.equal(doc.cases[0].status, 'failed_final');
  } finally {
    delete process.env.X_AUTOPOST_DETECTIVES_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('dashboard exposes diagnosis primaryCode and gaps', () => {
  const row = dashboard.formatCaseForDashboard({
    id: 'det_test',
    status: 'failed_final',
    skipReason: 'strategy_data_missing',
    skipReasonRaw: 'strategy_data_missing',
    finalSkipCode: 'STRATEGY_DATA_MISSING',
    attempts: 2,
    maxAttempts: 8,
    createdAt: '2026-07-03T12:00:00.000Z',
    updatedAt: '2026-07-03T12:01:00.000Z',
    beatPost: { text: FLOYD_BENDER },
    hints: { playerSlug: 'raheem-floyd' },
    investigationLog: [],
    diagnosis: {
      primaryCode: 'STRATEGY_DATA_MISSING',
      secondaryCodes: [],
      salvageable: true,
      gaps: ['no_rpm', 'no_visit'],
      beatKind: 'update',
      classifiedAt: '2026-07-03T12:01:00.000Z'
    }
  });
  assert.equal(row.skipCode, 'STRATEGY_DATA_MISSING');
  assert.equal(row.salvageable, true);
  assert.equal(row.beatKind, 'update');
  assert.deepEqual(row.gaps, ['no_rpm', 'no_visit']);
  assert.equal(row.skipReasonRaw, 'strategy_data_missing');
});

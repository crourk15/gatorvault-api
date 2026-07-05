/** Player resolution ledger + pre-flight gates */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function tempLedgerDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-resolution-'));
  process.env.X_AUTOPOST_DETECTIVES_DATA_DIR = dir;
  delete require.cache[require.resolve('../../lib/autoposter/player-resolution-ledger')];
  delete require.cache[require.resolve('../../lib/autoposter/player-resolution-preflight')];
  return dir;
}

test('markResolvedArchive blocks future enqueue checks', () => {
  tempLedgerDir();
  const ledger = require('../../lib/autoposter/player-resolution-ledger');
  ledger.markResolvedArchive('marquis-evans', 'committed_elsewhere', {
    source: 'test',
    committedTo: 'Auburn'
  });
  const blocked = ledger.checkPlayerResolution('marquis-evans');
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.reason, 'player_archived');
  assert.equal(blocked.archiveReason, 'committed_elsewhere');
});

test('markResolvedPublish blocks duplicate unless new intel fingerprint', () => {
  tempLedgerDir();
  const ledger = require('../../lib/autoposter/player-resolution-ledger');
  ledger.markResolvedPublish('ryan-drakeford', {
    source: 'test',
    intelFingerprint: 'fp_old'
  });
  const same = ledger.checkPlayerResolution('ryan-drakeford', { intelFingerprint: 'fp_old' });
  assert.equal(same.blocked, true);
  assert.equal(same.reason, 'duplicate_already_sent');

  const fresh = ledger.checkPlayerResolution('ryan-drakeford', { intelFingerprint: 'fp_new_beat' });
  assert.equal(fresh.blocked, false);
  assert.equal(fresh.newIntel, true);
});

test('preflight archives committed elsewhere from meta', async () => {
  tempLedgerDir();
  const preflight = require('../../lib/autoposter/player-resolution-preflight');
  const out = await preflight.evaluatePlayerPostPreflight({
    playerSlug: 'marquis-evans',
    beatText: 'Florida is tracking Marquis Evans in the 2028 class.',
    committedTo: 'Auburn'
  });
  assert.equal(out.ok, false);
  assert.equal(out.action, 'archive');
  assert.equal(out.archiveReason, 'committed_elsewhere');
});

test('preflight allows golden four slug without UF beat when allowGoldenFour', async () => {
  tempLedgerDir();
  const preflight = require('../../lib/autoposter/player-resolution-preflight');
  const out = await preflight.evaluatePlayerPostPreflight({
    playerSlug: 'bryce-willingham',
    beatText: 'Willingham visited Florida for spring practice.',
    allowGoldenFour: true
  });
  assert.equal(out.ok, true);
  assert.equal(out.action, 'enqueue');
});

test('preflight archives non-UF beat for non-golden slug', async () => {
  tempLedgerDir();
  const preflight = require('../../lib/autoposter/player-resolution-preflight');
  const out = await preflight.evaluatePlayerPostPreflight({
    playerSlug: 'some-prospect',
    beatText: 'Washington landed a big commitment from a four-star lineman.'
  });
  assert.equal(out.ok, false);
  assert.equal(out.action, 'archive');
  assert.equal(out.archiveReason, 'uf_irrelevant');
});

test('mapSkipCodeToArchiveReason maps classifier codes', () => {
  tempLedgerDir();
  const ledger = require('../../lib/autoposter/player-resolution-ledger');
  assert.equal(ledger.mapSkipCodeToArchiveReason('BEAT_OPPONENT_PRIORITY'), 'uf_irrelevant');
  assert.equal(ledger.mapSkipCodeToArchiveReason('EXHAUSTED_PROMOTE'), 'exhausted_promote');
});

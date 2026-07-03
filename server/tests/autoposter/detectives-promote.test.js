/** Detectives PR3 voice promote tests */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const promote = require('../../lib/autoposter/detectives-promote');
const voiceEngine = require('../../lib/autoposter/voice-engine');

const FLOYD_BEAT =
  'Nearly three weeks ago, I submitted an RPM pick for Florida to land 4-star CB Raheem Floyd. With decision day approaching, is that still the call?';

test('hasPromotableMetrics requires at least one strategy field', () => {
  assert.equal(promote.hasPromotableMetrics({}), false);
  assert.equal(promote.hasPromotableMetrics({ rpm: 62 }), true);
  assert.equal(promote.hasPromotableMetrics({ visitDate: '2026-08-12' }), true);
  assert.equal(promote.hasPromotableMetrics({ compSchools: ['FSU'] }), true);
});

test('composeFromDetectiveCase applies detectiveOverride metrics', async () => {
  process.env.VOICE_PHRASE_MEMORY = 'false';
  const out = await voiceEngine.composeFromDetectiveCase({
    hints: {
      beatText: FLOYD_BEAT,
      writerName: 'Corey Bender',
      publishedAt: '2026-07-03T12:33:57.000Z'
    },
    identity: {
      playerName: 'Raheem Floyd',
      playerSlug: 'raheem-floyd',
      classYear: 2027,
      pos: 'CB'
    },
    platformContext: {
      url: 'https://gatorvaultinsider.com/vault/futurecast/player/raheem-floyd#futurecast'
    },
    research: { eventType: 'prediction' },
    detectiveOverride: {
      rpm: 62,
      visitDate: '2026-08-12',
      compSchools: ['FSU', 'Miami']
    }
  });

  assert.equal(out.ok, true);
  assert.ok(out.text);
  assert.ok(out.text.length <= 280);
  assert.equal(out.validationMeta.detectiveOverride, true);
  assert.equal(out.validationMeta.detectivesPromoted, true);
  assert.equal(out.validationMeta.voiceMetrics.rpm, 62);
});

test('buildVoicePromoteCandidate logs promote phase on success', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'det-promote-'));
  process.env.X_AUTOPOST_DETECTIVES_DATA_DIR = dir;
  process.env.VOICE_PHRASE_MEMORY = 'false';
  const storePath = require.resolve('../../lib/autoposter/detectives-store');
  const promotePath = require.resolve('../../lib/autoposter/detectives-promote');
  delete require.cache[storePath];
  delete require.cache[promotePath];
  const store = require(storePath);
  const promoteMod = require(promotePath);

  try {
    const added = store.addCase({
      skipReason: 'strategy_data_missing',
      beatPost: { text: FLOYD_BEAT, handle: 'Corey_Bender' },
      hints: {
        playerSlug: 'raheem-floyd',
        metrics: { rpm: 62, visitDate: '2026-08-12', compSchools: ['FSU', 'Miami'] }
      }
    });

    const cand = await promoteMod.buildVoicePromoteCandidate({
      caseItem: added.case,
      hints: {
        beatText: FLOYD_BEAT,
        writerName: 'Corey Bender',
        publishedAt: '2026-07-03T12:33:57.000Z',
        metrics: { rpm: 62, visitDate: '2026-08-12', compSchools: ['FSU', 'Miami'] }
      },
      identity: {
        playerName: 'Raheem Floyd',
        playerSlug: 'raheem-floyd',
        classYear: 2027,
        pos: 'CB'
      },
      platformContext: {
        url: 'https://gatorvaultinsider.com/vault/futurecast/player/raheem-floyd#futurecast'
      },
      research: { eventType: 'prediction' }
    });

    assert.ok(cand?.text);
    assert.equal(cand.validationMeta.detectiveOverride, true);
    const row = store.getCase(added.case.id);
    assert.ok(row.investigationLog.some((l) => l.phase === 'promote' && l.ok === true));
  } finally {
    delete process.env.X_AUTOPOST_DETECTIVES_DATA_DIR;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

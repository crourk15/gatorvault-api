/** Voice Engine v1.1.1 tests */
const test = require('node:test');
const assert = require('node:assert/strict');

const voiceEngine = require('../../lib/autoposter/voice-engine');
const signalAdapter = require('../../lib/autoposter/voice-signal-adapter');
const voiceQa = require('../../lib/autoposter/voice-qa');
const phraseMemory = require('../../lib/autoposter/voice-phrase-memory');

const FLOYD_SIGNAL = {
  id: 'beat_prediction_raheem-floyd_test',
  type: 'recruiting',
  player: {
    name: 'Raheem Floyd',
    pos: 'CB',
    classYear: 2027,
    school: 'GA',
    ranking: 142
  },
  event: {
    kind: 'prediction',
    timestamp: '2026-07-03T12:33:57.000Z',
    description:
      'Nearly three weeks ago, I submitted an RPM pick for Florida to land 4-star CB Raheem Floyd. With decision day approaching, is that still the call?',
    source: 'Corey Bender'
  },
  metrics: {
    rpm: 62,
    visitDate: '2026-08-12',
    compSchools: ['FSU', 'Miami'],
    depthChartNote: null,
    schemeNote: null
  },
  links: {
    playerUrl: 'https://gatorvaultinsider.com/vault/futurecast/player/raheem-floyd#futurecast'
  },
  beatText:
    'Nearly three weeks ago, I submitted an RPM pick for Florida to land 4-star CB Raheem Floyd. With decision day approaching, is that still the call?',
  playerSlug: 'raheem-floyd'
};

test('signal adapter resolves recruiting mode', () => {
  assert.equal(signalAdapter.resolveMode(FLOYD_SIGNAL), 'recruiting');
});

test('voice compose produces post under 280 chars with strategy data', () => {
  process.env.VOICE_PHRASE_MEMORY = 'false';
  const out = voiceEngine.autoposterCompose(FLOYD_SIGNAL);
  assert.equal(out.ok, true, out.reason || 'compose failed');
  assert.ok(out.text.length <= 280, `too long: ${out.text.length}`);
  assert.match(out.text, /Raheem Floyd/i);
  assert.match(out.text, /futurecast\/player\/raheem-floyd/);
  assert.ok(out.blocks.strategy);
  assert.ok(out.validationMeta.voiceEngine);
});

test('voice compose skips when strategy data missing', () => {
  const weak = {
    ...FLOYD_SIGNAL,
    metrics: { rpm: null, visitDate: null, compSchools: [], depthChartNote: null, schemeNote: null }
  };
  const out = voiceEngine.autoposterCompose(weak);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'strategy_data_missing');
});

test('voice QA rejects hype language', () => {
  const blocks = {
    intel: 'BREAKING: Florida lands a target.',
    context: 'Florida needs CB depth in this class.',
    strategy: 'UF leads On3 RPM at 55%.',
    hook: 'Circle this one.',
    cta: 'https://gatorvaultinsider.com/player/test'
  };
  const gate = voiceQa.runQualityGate(FLOYD_SIGNAL, blocks, Object.values(blocks).join(' '), {
    playerName: 'Raheem Floyd'
  });
  assert.equal(gate.passed, false);
  assert.ok(gate.reasons.includes('hype_language'));
});

test('phrase memory blocks repeated hooks within window', () => {
  process.env.VOICE_PHRASE_MEMORY = 'true';
  const used = 'QA hook alpha unique.';
  const fresh = 'QA hook beta unique.';
  phraseMemory.recordHook(used);
  assert.equal(phraseMemory.hookRecentlyUsed(used), true);
  const picked = phraseMemory.pickUniqueHook([used, fresh]);
  assert.equal(picked, fresh);
});

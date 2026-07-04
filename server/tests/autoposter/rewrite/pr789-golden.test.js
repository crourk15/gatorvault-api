/** PR-7/8/9 golden tests — competition, trajectory, brand voice. */
const test = require('node:test');
const assert = require('node:assert/strict');

const voiceEngine = require('../../../lib/autoposter/voice-engine');
const pr6 = require('../../../lib/autoposter/rewrite');
const { GOLDEN_BEATS, toSignal } = require('../fixtures/golden-beats');

process.env.VOICE_PHRASE_MEMORY = 'false';
process.env.X_AUTOPOST_PR6_SHADOW = 'true';
process.env.X_AUTOPOST_PR7_8_9_SHADOW = 'true';
process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'false';

const FOUR = ['drakeford', 'robinson', 'willingham', 'ham'];

function composePr789(id) {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true, `${id} PR-5 failed`);
  const pr5Pack = pr6.buildPr5PackFromBlocks(out.blocks, signal);
  const pr6Pack = pr6.rewriteStrategyPack(pr5Pack, signal, { cta: out.blocks.cta });
  assert.equal(pr6Pack.ok, true, `${id} PR-6 failed`);
  return { signal, pr5Pack, pr6Pack, pr789: pr6Pack.pr789, metadata: out.metadata };
}

for (const id of FOUR) {
  test(`PR-789 golden — ${id} enhances PR-6 or falls back safely`, () => {
    const { pr789, pr6Pack } = composePr789(id);
    assert.ok(pr789, 'PR-789 shadow should run');
    if (pr789.ok) {
      assert.ok(pr789.charCount <= 280, `${id} too long: ${pr789.charCount}`);
      assert.equal(pr6.isCompleteSentence(pr789.narrative1), true);
      assert.equal(pr6.isCompleteSentence(pr789.narrative2), true);
    } else {
      assert.equal(pr789.fallback, true);
      assert.equal(pr789.pr6Pack.rewrittenTweet, pr6Pack.rewrittenTweet);
    }
  });
}

test('PR-7 — Ham uses only FSU from compSchools', () => {
  const { signal, pr789 } = composePr789('ham');
  if (!pr789?.ok) return;
  const comp = pr6.validateCompetitionLine(pr789.rewrittenTweet, pr6.buildPr5PackFromBlocks({}, signal), signal);
  assert.equal(comp.ok, true, JSON.stringify(comp.violations));
  assert.match(pr789.rewrittenTweet, /FSU/i);
  assert.doesNotMatch(pr789.rewrittenTweet, /early favorite/i);
});

test('PR-7 — Drakeford mentions no comp schools', () => {
  const { pr789 } = composePr789('drakeford');
  if (!pr789?.ok) return;
  assert.doesNotMatch(pr789.rewrittenTweet, /\b(FSU|Miami|Ohio State|Alabama)\b/i);
});

test('PR-8 — trajectory position matches player', () => {
  const { signal, pr789 } = composePr789('ham');
  if (!pr789?.ok) return;
  const traj = pr6.validateTrajectoryLine(pr789.rewrittenTweet, {}, signal);
  assert.equal(traj.ok, true, JSON.stringify(traj.violations));
});

test('PR-9 — brand voice has momentum/energy marker, no outcome prediction', () => {
  const { pr789 } = composePr789('willingham');
  if (!pr789?.ok) return;
  const brand = pr6.validateBrandVoiceLine(pr789.rewrittenTweet);
  assert.equal(brand.ok, true, JSON.stringify(brand.violations));
  assert.doesNotMatch(pr789.rewrittenTweet, /will land|will end in/i);
});

test('PR-789 shadow metadata attached in voice-engine', () => {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'robinson'));
  const out = voiceEngine.autoposterCompose(signal);
  assert.ok(out.metadata?.pr789Shadow);
});

test('PR-789 — Ham n2 avoids repeating separation framing', () => {
  const { pr789 } = composePr789('ham');
  if (!pr789?.ok) return;
  assert.match(pr789.narrative1, /separate from FSU/i);
  assert.doesNotMatch(pr789.narrative2, /gained separation|separate from/i);
  assert.match(pr789.narrative2, /face time|widening|cycle/i);
});

test('PR-789 blocks unsafe competition framing', () => {
  const fake = pr6.validateCompetitionLine('UF took the lead over FSU in this race.', { compSchools: ['FSU'] }, {
    metrics: { compSchools: ['FSU'] }
  });
  assert.equal(fake.ok, false);
});

test('PR-789 live publishes enhanced copy on golden four when enabled', () => {
  const prev6 = process.env.X_AUTOPOST_PR6_ENABLED;
  const prev789 = process.env.X_AUTOPOST_PR7_8_9_ENABLED;
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  try {
    const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'ham'));
    signal.playerSlug = 'ham';
    const out = voiceEngine.autoposterCompose(signal);
    assert.equal(out.ok, true);
    assert.equal(out.metadata?.pr6Live, true);
    assert.equal(out.metadata?.pr789Live, true);
    assert.match(out.text, /separate from FSU/i);
    assert.match(out.text, /face time|widening|momentum/i);
    assert.doesNotMatch(out.text, /gained separation after that trip/i);
  } finally {
    process.env.X_AUTOPOST_PR6_ENABLED = prev6;
    process.env.X_AUTOPOST_PR7_8_9_ENABLED = prev789;
  }
});

test('PR-789 live does not publish on non-golden beats when enabled', () => {
  const prev6 = process.env.X_AUTOPOST_PR6_ENABLED;
  const prev789 = process.env.X_AUTOPOST_PR7_8_9_ENABLED;
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  process.env.X_AUTOPOST_PR7_8_9_ENABLED = 'true';
  try {
    const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'zylen'));
    signal.playerSlug = 'zylen';
    const out = voiceEngine.autoposterCompose(signal);
    assert.equal(out.ok, true);
    assert.notEqual(out.metadata?.pr6Live, true);
    assert.notEqual(out.metadata?.pr789Live, true);
  } finally {
    process.env.X_AUTOPOST_PR6_ENABLED = prev6;
    process.env.X_AUTOPOST_PR7_8_9_ENABLED = prev789;
  }
});

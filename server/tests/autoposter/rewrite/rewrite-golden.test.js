/** PR-6 golden tests — before/after rewrite quality gates. */
const test = require('node:test');
const assert = require('node:assert/strict');

const voiceEngine = require('../../../lib/autoposter/voice-engine');
const pr6 = require('../../../lib/autoposter/rewrite');
const { GOLDEN_BEATS, toSignal } = require('../fixtures/golden-beats');
const { getTweetCharLimit } = require('../../../lib/autoposter/tweet-char-limit');

process.env.VOICE_PHRASE_MEMORY = 'false';
process.env.X_AUTOPOST_PR6_SHADOW = 'true';
process.env.X_AUTOPOST_PR6_ENABLED = 'false';

const GOLDEN_FOUR = ['drakeford', 'robinson', 'willingham', 'ham'];

const PR6_MARKERS = {
  drakeford: [/swamp/i, /traction|lane|board/i, /top schools|top-school/i],
  robinson: [/lean|staff|db/i, /responded|board/i, /capital|lane/i],
  willingham: [/foothold|spring/i, /top schools/i, /lane|positioned/i],
  ham: [/march|visit|campus/i, /energy|staff/i, /early March|loved/i]
};

function composePr6(id) {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true, `${id} PR-5 failed: ${out.reason}`);
  const pr5Pack = pr6.buildPr5PackFromBlocks(out.blocks, signal);
  return pr6.rewriteStrategyPack(pr5Pack, signal, { cta: out.blocks.cta });
}

for (const id of GOLDEN_FOUR) {
  test(`PR-6 golden — ${id} passes all rewrite gates`, () => {
    const rewritten = composePr6(id);
    assert.equal(rewritten.ok, true, `${id}: ${rewritten.reason} — ${JSON.stringify(rewritten.trace?.violations)}`);
    assert.ok(rewritten.charCount <= getTweetCharLimit(), `${id} too long: ${rewritten.charCount}`);
    assert.equal(pr6.isCompleteSentence(rewritten.narrative1), true, rewritten.narrative1);
    assert.equal(pr6.isCompleteSentence(rewritten.narrative2), true, rewritten.narrative2);
    assert.doesNotMatch(rewritten.rewrittenTweet, /\+/);
  });

  test(`PR-6 golden — ${id} elite tone markers`, () => {
    const rewritten = composePr6(id);
    assert.equal(rewritten.ok, true);
    const tone = pr6.validatePackTone([rewritten.narrative1, rewritten.narrative2]);
    assert.equal(tone.ok, true, JSON.stringify(tone.violations));
    const markers = PR6_MARKERS[id] || [];
    for (const re of markers) {
      assert.match(`${rewritten.narrative1} ${rewritten.narrative2}`, re);
    }
  });

  test(`PR-6 golden — ${id} provenance safe`, () => {
    const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
    const out = voiceEngine.autoposterCompose(signal);
    const pr5Pack = pr6.buildPr5PackFromBlocks(out.blocks, signal);
    const rewritten = pr6.rewriteStrategyPack(pr5Pack, signal, { cta: out.blocks.cta });
    const prov = pr6.isProvenanceSafe(`${rewritten.narrative1} ${rewritten.narrative2}`, pr5Pack);
    assert.equal(prov.ok, true, JSON.stringify(prov.violations));
  });
}

test('PR-6 shadow mode attaches trace without replacing PR-5 text', () => {
  const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'drakeford'));
  const out = voiceEngine.autoposterCompose(signal);
  assert.equal(out.ok, true);
  assert.ok(out.metadata?.pr6Shadow);
  assert.equal(out.metadata.pr6Shadow.ok, true);
  assert.ok(out.metadata.pr6Shadow.rewrittenTweet);
  assert.notEqual(out.metadata.pr6Shadow.rewrittenTweet, out.text);
});

test('PR-6 live replaces text on golden four when enabled', () => {
  const prev = process.env.X_AUTOPOST_PR6_ENABLED;
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  try {
    for (const id of GOLDEN_FOUR) {
      const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === id));
      signal.playerSlug = id;
      const out = voiceEngine.autoposterCompose(signal);
      assert.equal(out.ok, true, id);
      assert.equal(out.metadata.pr6Live, true, id);
      assert.equal(out.text, out.metadata.pr6Shadow.rewrittenTweet, id);
      assert.ok(out.metadata.pr5Text);
      assert.notEqual(out.text, out.metadata.pr5Text, id);
    }
  } finally {
    process.env.X_AUTOPOST_PR6_ENABLED = prev;
  }
});

test('PR-6 live does not replace non-golden beats when enabled', () => {
  const prev = process.env.X_AUTOPOST_PR6_ENABLED;
  process.env.X_AUTOPOST_PR6_ENABLED = 'true';
  try {
    const signal = toSignal(GOLDEN_BEATS.find((b) => b.id === 'zylen'));
    signal.playerSlug = 'zylen';
    const out = voiceEngine.autoposterCompose(signal);
    assert.equal(out.ok, true);
    assert.notEqual(out.metadata?.pr6Live, true);
    assert.notEqual(out.text, out.metadata?.pr6Shadow?.rewrittenTweet);
    assert.ok(out.metadata?.pr6Shadow?.rewrittenTweet);
  } finally {
    process.env.X_AUTOPOST_PR6_ENABLED = prev;
  }
});

test('PR-6 blocks generic PR-5 phrasing in rewrite output', () => {
  const rewritten = composePr6('willingham');
  assert.equal(rewritten.ok, true);
  assert.doesNotMatch(rewritten.rewrittenTweet, /strong early spot/i);
  assert.doesNotMatch(rewritten.rewrittenTweet, /told on3/i);
});

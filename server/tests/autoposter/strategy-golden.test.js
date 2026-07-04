/** PR-5 golden tests — Extract → Compose → Score → Guard → Trace. */
const test = require('node:test');
const assert = require('node:assert/strict');

const { buildStrategyEngineOutput } = require('../../lib/autoposter/strategy/strategy-engine');
const { containsBannedPhrase } = require('../../lib/autoposter/strategy/strategy-provenance');
const { BANNED_STRATEGY_PHRASES, GOLDEN_OVERLAP_THRESHOLD, MIN_STRATEGY_CHARS } = require('../../lib/autoposter/strategy/strategy-types');
const { maxPairwiseOverlap } = require('../../lib/autoposter/strategy/strategy-overlap');
const { isTruncatedBadly } = require('../../lib/autoposter/strategy/strategy-guard');
const voiceQa = require('../../lib/autoposter/voice-qa');
const { GOLDEN_BEATS, toSignal } = require('./fixtures/golden-beats');

const prevEngine = process.env.X_AUTOPOST_STRATEGY_ENGINE;
delete process.env.X_AUTOPOST_STRATEGY_ENGINE;

test.after(() => {
  if (prevEngine === undefined) delete process.env.X_AUTOPOST_STRATEGY_ENGINE;
  else process.env.X_AUTOPOST_STRATEGY_ENGINE = prevEngine;
});

for (const beat of GOLDEN_BEATS) {
  test(`PR-5 golden: ${beat.id} produces non-zero strategy`, () => {
    const out = buildStrategyEngineOutput(toSignal(beat));
    assert.ok(out.strategyLine, `missing strategy for ${beat.id}`);
    assert.ok(out.contextLine, `missing context for ${beat.id}`);
    assert.notEqual(out.confidence, 'zero', `zero confidence for ${beat.id}: ${JSON.stringify(out.trace)}`);
    assert.ok(out.strategyLine.length >= MIN_STRATEGY_CHARS, `strategy too short for ${beat.id}`);
    assert.equal(isTruncatedBadly(out.strategyLine), false, `truncated strategy for ${beat.id}: ${out.strategyLine}`);
    assert.equal(containsBannedPhrase(out.strategyLine, BANNED_STRATEGY_PHRASES), null);
    assert.equal(containsBannedPhrase(out.contextLine, BANNED_STRATEGY_PHRASES), null);
    assert.ok(out.trace?.templateId, `no template for ${beat.id}`);
    assert.ok(out.trace.chosenTypes.length >= 1, `no chosen types for ${beat.id}`);
  });
}

test('PR-5 golden eight — strategy lines stay below overlap threshold', () => {
  const lines = GOLDEN_BEATS.map((beat) => buildStrategyEngineOutput(toSignal(beat)).strategyLine);
  const { max, pairs } = maxPairwiseOverlap(lines, GOLDEN_OVERLAP_THRESHOLD);
  assert.ok(
    max < GOLDEN_OVERLAP_THRESHOLD,
    `overlap too high (${max.toFixed(2)}): ${pairs.map((p) => `${GOLDEN_BEATS[p.i].id}/${GOLDEN_BEATS[p.j].id}=${p.score.toFixed(2)}`).join(', ')}`
  );
});

test('PR-5 golden — weak beat yields zero confidence', () => {
  const out = buildStrategyEngineOutput({
    beatText: 'Quiet offseason notes on a national recruit with no UF context attached.',
    player: { name: 'Unknown Player', pos: 'ATH', classYear: 2028 },
    metrics: {}
  });
  assert.equal(out.confidence, 'zero');
  assert.equal(out.strategyLine, null);
});

test('PR-5 golden — Drakeford uses visit+board template', () => {
  const beat = GOLDEN_BEATS.find((b) => b.id === 'drakeford');
  const out = buildStrategyEngineOutput(toSignal(beat));
  assert.equal(out.trace.templateId, 'visit_board');
  assert.match(out.strategyLine, /first trip|The Swamp/i);
  assert.match(out.strategyLine, /top of my board/i);
});

test('PR-5 golden — Willingham passes UF context QA', () => {
  const beat = GOLDEN_BEATS.find((b) => b.id === 'willingham');
  const out = buildStrategyEngineOutput(toSignal(beat));
  assert.ok(out.contextLine);
  assert.equal(voiceQa.hasUfContext(out.contextLine), true, out.contextLine);
});

test('PR-5 golden — Robinson uses visit+board or visit+staff', () => {
  const beat = GOLDEN_BEATS.find((b) => b.id === 'robinson');
  const out = buildStrategyEngineOutput(toSignal(beat));
  assert.ok(['visit_board', 'visit_staff', 'board_staff'].includes(out.trace.templateId));
  assert.equal(out.trace.templateId, 'visit_staff');
});

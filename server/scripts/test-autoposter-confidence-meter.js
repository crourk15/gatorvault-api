/**
 * Smoke test — GatorVault Confidence Meter (0–100, six signals).
 */
const meter = require('../lib/x-autoposter-confidence-meter');
const template = require('../lib/x-autoposter-template');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

assert('cold label at 15', meter.labelForScore(15) === 'Cold');
assert('hot label at 84', meter.labelForScore(84) === 'Hot');
assert('very hot at 92', meter.displayLabel(92) === 'Very Hot');
assert('score clamped to 100', meter.clampScore(150) === 100);
assert('score clamped to 0', meter.clampScore(-10) === 0);

const visitHot = meter.computeConfidenceMeter({
  situation: 'visit',
  beatText: 'Jaylen Brown is on campus today for his official visit to Florida. Staff pushing hard.',
  identity: { ufRpmPct: 55, isUFtarget: true },
  research: { ufPosition: 'leading' }
});
assert('visit + staff push scores warm or better', visitHot.score >= 60);
assert('visit signal awards points', visitHot.signals.visit.points >= 20);
assert('has explanation template', visitHot.explanation.includes('Florida'));

const cancelled = meter.computeConfidenceMeter({
  situation: 'visit',
  beatText: 'Brown cancelled his official visit to Gainesville.',
  identity: {}
});
assert('cancelled visit subtracts', cancelled.signals.visit.points <= 0);

const cold = meter.computeConfidenceMeter({
  situation: 'general',
  beatText: 'National recruiting note with no UF angle.',
  identity: { school: 'Miami' }
});
assert('minimal signals stay cold/cool', cold.score <= 40);

const composed = template.composeInsiderReportWithMeters({
  identity: '4★ WR Jaylen Brown (2025 · Miami)',
  context: 'Jaylen Brown is on campus today for a Florida visit.',
  insider: 'The staff views this as a key checkpoint in their pursuit.',
  confidenceMeter: visitHot
});
assert('composed post includes confidence header', /Confidence Meter: \d+ \(.+\)/.test(composed));
assert('composed post includes explanation', composed.includes(visitHot.explanation));

if (process.exitCode) {
  console.error('\nConfidence meter smoke test failed.');
} else {
  console.log('\nAll confidence meter smoke tests passed.');
}

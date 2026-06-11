/**
 * Smoke test — GatorVault Heat Meter (RISING / HOLDING / COOLING).
 */
const heat = require('../lib/x-autoposter-heat-meter');
const template = require('../lib/x-autoposter-template');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const risingVisit = heat.computeHeatMeter({
  situation: 'visit',
  beatText: 'Jaylen Brown is on campus today for his official visit to Florida.',
  playerSlug: 'jaylen-brown'
});
assert('visit today is RISING', risingVisit.state === 'RISING');
assert('rising total >= 3', risingVisit.total >= 3);
assert('rising explanation mentions momentum', /gaining momentum/i.test(risingVisit.explanation));

const cooling = heat.computeHeatMeter({
  situation: 'visit',
  beatText: 'Brown cancelled his official visit to Gainesville.'
});
assert('cancelled visit is COOLING', cooling.state === 'COOLING');
assert('cooling total <= -1', cooling.total <= -1);

const holding = heat.computeHeatMeter({
  situation: 'general',
  beatText: 'Florida continues to track this prospect with steady communication.'
});
assert('steady track is HOLDING', holding.state === 'HOLDING');

const composed = template.composeInsiderReportWithMeters({
  identity: '4★ WR Jaylen Brown (2025 · Miami)',
  context: 'Jaylen Brown is on campus today for a Florida visit.',
  insider: 'The staff views this as a key checkpoint in their pursuit.',
  heatMeter: risingVisit,
  confidenceMeter: {
    header: 'Confidence Meter: 84 (Hot)',
    explanation: 'The Gators are in a strong position here, and staff confidence continues to rise.'
  }
});
assert('post includes heat before confidence', composed.indexOf('Heat Meter:') < composed.indexOf('Confidence Meter:'));
assert('post includes both meters', /Heat Meter:/.test(composed) && /Confidence Meter: 84/.test(composed));

if (process.exitCode) {
  console.error('\nHeat meter smoke test failed.');
} else {
  console.log('\nAll heat meter smoke tests passed.');
}

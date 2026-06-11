/**
 * Smoke test — autoposter data layer (freshness, identity priority, UF filter).
 */
const dataLayer = require('../lib/x-autoposter-data-layer');
const postSpec = require('../lib/x-autoposter-post-spec');

function assert(label, condition) {
  if (!condition) {
    console.error('FAIL:', label);
    process.exitCode = 1;
    return;
  }
  console.log('OK:', label);
}

const fresh = dataLayer.assertIntelFresh({ timestamp: new Date().toISOString() });
assert('fresh intel passes', fresh.ok);

const stale = dataLayer.assertIntelFresh({
  timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
});
assert('stale intel rejected', !stale.ok && stale.skipReason === 'stale_intel');

const noTs = dataLayer.assertIntelFresh({});
assert('missing timestamp rejected', !noTs.ok);

assert(
  'missing situation detected',
  dataLayer.listMissingPostFields(
    { name: 'Jaylen Brown', position: 'WR', classYear: 2025 },
    { beatText: 'random note with no event signal' },
    'general',
    Date.now()
  ).includes('situation')
);

assert('visit situation from beat', postSpec.detectSituation('Jaylen Brown is on campus today in Gainesville', null) === 'visit');
assert('offer situation from beat', postSpec.detectSituation('Florida extended an offer to John Smith', null) === 'offer');
assert('portal situation from beat', postSpec.detectSituation('Chris Allen entered the portal', null) === 'portal');

assert(
  'UF filter passes for target',
  dataLayer.passesUfFilter({ isUFtarget: true, category: 'target' }, { beatText: 'visit update' })
);
assert(
  'UF filter rejects non-UF',
  !dataLayer.passesUfFilter({ school: 'Miami', category: 'other' }, { beatText: 'generic national note' })
);
assert(
  'UF filter passes beat florida mention',
  dataLayer.passesUfFilter({ school: 'Miami' }, { beatText: 'Florida is pushing for this WR' })
);

const missing = dataLayer.listMissingCoreIdentity({ name: 'Test Player', position: null, class: null });
assert('missing identity detects gaps', missing.includes('position') && missing.includes('class'));

const coach = dataLayer.findCoachInStaffDb('Marcus Davis');
assert('staff DB lookup finds coach', coach?.name === 'Marcus Davis' && !!coach.title);

if (process.exitCode) {
  console.error('\nData layer smoke test failed.');
} else {
  console.log('\nAll data layer smoke tests passed.');
}

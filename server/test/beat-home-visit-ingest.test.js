/**
 * Beat ingest must classify Florida in-home visits.
 * Run: node server/test/beat-home-visit-ingest.test.js
 */
const assert = require('assert');
const { resolveRecruitingEventType } = require('../lib/beat-writer-ingest');
const { VISIT_EVENT_TYPES } = require('../lib/recruiting-dig-deeper-ingest');

function main() {
  const home = resolveRecruitingEventType(
    'Florida coaches were in the home with 2028 OT Samuel Bailey this week for a home visit.'
  );
  assert.strictEqual(home, 'home_visit');
  assert.ok(VISIT_EVENT_TYPES.has('home_visit'));

  const ov = resolveRecruitingEventType(
    'Samuel Bailey is set for an official visit to Florida this weekend.'
  );
  assert.strictEqual(ov, 'official_visit');

  const uv = resolveRecruitingEventType(
    'Samuel Bailey took an unofficial visit to Gainesville on Saturday.'
  );
  assert.strictEqual(uv, 'unofficial_visit');

  console.log('beat-home-visit-ingest.test.js: PASS');
}

main();

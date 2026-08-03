/**
 * On3 profile offer extract must include Florida (chase / Detectives).
 * Run: node server/test/on3-ingest-florida-offers.test.js
 */
const assert = require('assert');
const { extractOn3ProfileOffers } = require('../lib/on3-ingest');

function teamRow(name, status, year = 2028) {
  return {
    year,
    status,
    team: { name, fullName: name === 'Florida' ? 'Florida Gators' : `${name}` },
  };
}

function main() {
  const topTeams = [
    teamRow('Alabama', 'Offered'),
    teamRow('Florida', 'Offered'),
    teamRow('Ohio State', 'Interested'),
  ];

  const offers = extractOn3ProfileOffers(topTeams, 2028);
  const schools = offers.map((o) => o.school).sort();
  assert.deepStrictEqual(schools, ['Alabama', 'Florida']);
  const fl = offers.find((o) => o.school === 'Florida');
  assert.ok(fl);
  assert.match(String(fl.offerType), /offer/i);
  assert.strictEqual(fl.source, 'on3');

  console.log('on3-ingest-florida-offers.test.js: PASS');
}

main();

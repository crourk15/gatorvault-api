/**
 * normalizePlayer must keep Florida offer / On3 team signals for chase + Detectives.
 * Run: node server/test/recruiting-store-preserve-offers.test.js
 */
const assert = require('assert');
const { normalizePlayer } = require('../lib/recruiting-store');

function main() {
  const raw = {
    slug: 'cyion-smith',
    name: 'Cyion Smith',
    pos: 'S',
    classYear: 2028,
    school: 'Blountstown (Blountstown, FL)',
    offers: [{ school: 'Florida', offerType: 'Offered', source: 'on3' }],
    on3TopTeams: [{ year: 2028, status: 'Offered', team: { name: 'Florida', fullName: 'Florida Gators' } }],
    topTeams: [{ year: 2028, status: 'Offered', team: { name: 'Florida' } }],
    visits: [{ school: 'Florida', visitType: 'Unofficial' }],
    ufRpmPct: 97,
  };
  const p = normalizePlayer(raw);
  assert.ok(Array.isArray(p.offers) && p.offers.length === 1);
  assert.strictEqual(p.offers[0].school, 'Florida');
  assert.ok(Array.isArray(p.on3TopTeams) && p.on3TopTeams.length === 1);
  assert.ok(Array.isArray(p.topTeams) && p.topTeams.length === 1);
  assert.ok(Array.isArray(p.visits) && p.visits.length === 1);
  assert.strictEqual(p.ufRpmPct, 97);
  console.log('recruiting-store-preserve-offers.test.js: PASS');
}

main();

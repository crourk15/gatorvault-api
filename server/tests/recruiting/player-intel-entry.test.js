const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseOfferFlag,
  placementForClassYear,
} = require('../../lib/player-intel-entry');
const { addToAdminAllowlist, loadAdminAllowlist } = require('../../lib/admin-allowlist-store');
const { getAllowlistSet, isAllowlistedTarget } = require('../../lib/recruiting-target-allowlist');

test('parseOfferFlag detects UF offer variants', () => {
  assert.equal(parseOfferFlag(true), true);
  assert.equal(parseOfferFlag('uf'), true);
  assert.equal(parseOfferFlag('Florida'), true);
  assert.equal(parseOfferFlag('no'), false);
  assert.equal(parseOfferFlag(false), false);
});

test('placementForClassYear routes to correct sections', () => {
  assert.equal(placementForClassYear(2027).section, 'master-board');
  assert.equal(placementForClassYear(2027).allowlist, false, '2027 Closing Class is hard-locked');
  assert.equal(placementForClassYear(2028).section, 'master-board');
  assert.equal(placementForClassYear(2028).allowlist, true);
  assert.equal(placementForClassYear(2029).section, 'underclassmen-watchboard');
});

test('admin allowlist merges into board filter', () => {
  const slug = `test-intel-entry-${Date.now()}`;
  addToAdminAllowlist({ slug, name: 'Test Intel Entry Player', classYear: 2028 });
  const set = getAllowlistSet(2028);
  assert.ok(set.has(slug));
  assert.ok(
    isAllowlistedTarget({ slug, name: 'Test Intel Entry Player', classYear: 2028, committedTo: null })
  );
  // Remove test slug from admin allowlist file
  const fs = require('fs');
  const path = require('path');
  const doc = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/recruiting/admin-allowlist.json'), 'utf8')
  );
  doc.slugs2028 = (doc.slugs2028 || []).filter((s) => s !== slug);
  delete doc.names[slug];
  fs.writeFileSync(
    path.join(__dirname, '../../data/recruiting/admin-allowlist.json'),
    `${JSON.stringify(doc, null, 2)}\n`
  );
});

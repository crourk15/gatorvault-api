/**
 * 2028+ prospects committed elsewhere must stay off open/active chase.
 * No Committed elsewhere / flip lane for open-cycle yet — stamps only.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { isActiveUfTarget } = require('../../lib/recruiting-target-filters');
const {
  filterAllowlistedTargets,
  getAllowlistSet,
  isAllowlistedTarget,
} = require('../../lib/recruiting-target-allowlist');

const ELSEWHERE_2028 = [
  'cale-britt',
  'kingston-preyear',
  'kweli-fielder',
  'knox-annis',
  'trace-hawkins',
  'neimann-lawrence',
  'jerome-larue',
  'jackson-stecher',
];

function loadPlayers() {
  const p = path.join(__dirname, '../../data/recruiting/players.json');
  const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(doc) ? doc : doc.players || [];
}

describe('2028 committed elsewhere — off active chase (no lane)', () => {
  it('stamps committedTo / status and is not an active UF target', () => {
    const bySlug = new Map(loadPlayers().map((p) => [String(p.slug || '').toLowerCase(), p]));
    for (const slug of ELSEWHERE_2028) {
      const p = bySlug.get(slug);
      assert.ok(p, `missing player ${slug}`);
      assert.ok(p.committedTo, `${slug} needs committedTo`);
      assert.notEqual(String(p.status || '').toLowerCase(), 'target');
      assert.equal(isActiveUfTarget(p), false, `${slug} must not be active chase`);
      assert.equal(isAllowlistedTarget(p), false, `${slug} must not be allowlisted target`);
      assert.equal(getAllowlistSet(2028).has(slug), false);
    }
  });

  it('filterAllowlistedTargets drops them for 2028', () => {
    const rows = loadPlayers().filter((p) => ELSEWHERE_2028.includes(String(p.slug || '').toLowerCase()));
    assert.equal(filterAllowlistedTargets(rows, 2028).length, 0);
  });
});

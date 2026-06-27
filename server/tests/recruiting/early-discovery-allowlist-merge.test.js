const test = require('node:test');
const assert = require('node:assert/strict');
const allowlist = require('../../lib/recruiting-target-allowlist');
const {
  mergeAllowlistIntoDiscovery,
  ALLOWLIST_DISCOVERY_FLOOR,
  buildAllowlistDiscoveryRow,
} = require('../../lib/early-discovery-allowlist-merge');
const path = require('node:path');

test('mergeAllowlistIntoDiscovery backfills all 2028 allowlist slugs', () => {
  const merged = mergeAllowlistIntoDiscovery([], {
    classYearGte: 2028,
    minDiscoveryScore: 50,
    minUfFitScore: 0,
    limit: 100,
  });
  const slugs = new Set(merged.map((p) => p.slug));
  assert.ok(merged.length >= allowlist.ALLOWLIST_2028.length);
  for (const slug of allowlist.ALLOWLIST_2028) {
    assert.ok(slugs.has(slug), 'missing allowlist slug ' + slug);
  }
  const sample = merged.find((p) => p.slug === 'brysen-wright');
  assert.ok(sample);
  assert.equal(sample.allowlistTarget, true);
  assert.ok(Number(sample.discoveryScore) >= ALLOWLIST_DISCOVERY_FLOOR);
  assert.ok(Number(sample.ufProbability) > 0);
  assert.equal(sample.ufStatus, 'TARGET');
});

test('mergeAllowlistIntoDiscovery raises floor for existing low-score rows', () => {
  const merged = mergeAllowlistIntoDiscovery(
    [
      {
        id: '1',
        slug: 'bryce-willingham',
        fullName: 'Bryce Willingham',
        classYear: 2028,
        position: 'DL',
        state: 'FL',
        stars: 4,
        discoveryScore: 40,
        ufFitScore: 90,
        ufStatus: 'EVAL',
        signalCount: 0,
      },
    ],
    { classYearGte: 2028, minDiscoveryScore: 50, limit: 100 }
  );
  const row = merged.find((p) => p.slug === 'bryce-willingham');
  assert.ok(row);
  assert.equal(row.allowlistTarget, true);
  assert.ok(Number(row.discoveryScore) >= ALLOWLIST_DISCOVERY_FLOOR);
});

test('buildAllowlistDiscoveryRow includes ufProbability from board seed', () => {
  const boardBySlug = require('../../lib/target-board-path').loadTargetBoardBySlug(2028, path.join(__dirname, '../..'));
  const row = buildAllowlistDiscoveryRow(boardBySlug.get('brysen-wright'), 2028);
  assert.equal(row.allowlistTarget, true);
  assert.ok(Number(row.ufProbability) > 0 && Number(row.ufProbability) <= 1);
});

test('mergeAllowlistIntoDiscovery skips merge for 2029-only queries', () => {
  const input = [{ id: 'x', slug: 'only-one', fullName: 'Only One', classYear: 2029, discoveryScore: 80, signalCount: 0 }];
  const merged = mergeAllowlistIntoDiscovery(input, { classYearGte: 2029, limit: 100 });
  assert.equal(merged.length, 1);
  assert.equal(merged[0].slug, 'only-one');
});
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { isOpenUfDecommitPlayer } = require('../../lib/recruiting-verified-commits');
const { countSnapshotHubCommits, getSnapshotHubCommits } = require('../../lib/on3-snapshot-commits');
const { isGrantWeek2027ClassLine } = require('../../lib/recruiting-hub-cache');

test('Cain Van Norden is an open 2027 Florida decommit, not a hub commit', async () => {
  assert.equal(isOpenUfDecommitPlayer({ slug: 'cain-van-norden', on3Id: 251040 }), true);

  const players = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/recruiting/players.json'), 'utf8')
  );
  const row = players.find((p) => String(p.slug || '').toLowerCase() === 'cain-van-norden');
  assert.ok(row, 'player row must exist');
  assert.equal(String(row.status || '').toLowerCase(), 'decommitted');
  assert.equal(row.committedTo, null);
  assert.equal(row.protected, false);
  assert.notEqual(row.on3Source, 'on3-board-sync');

  const slugs = getSnapshotHubCommits(2027).map((p) => p.slug);
  assert.equal(slugs.includes('cain-van-norden'), false);
  assert.ok(slugs.includes('terrance-grant'));
  assert.ok(slugs.includes('moreno-fisher'));
  assert.equal(countSnapshotHubCommits(2027), 27);

  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;
  const store = require('../../lib/recruiting-store');
  const hub = await store.getHubHsCommits(2027);
  assert.equal(
    hub.some((p) => String(p.slug || '').toLowerCase() === 'cain-van-norden'),
    false
  );
  assert.ok(hub.some((p) => p.slug === 'terrance-grant'));
  assert.equal(hub.length, 27);
});

test('Grant-week 28 / 61% class line is stale after the Van Norden decommit', () => {
  assert.equal(
    isGrantWeek2027ClassLine({ classRank: '#6', blueChip: '61%', commits: '28', avgRating: '90.1' }),
    true
  );
  assert.equal(
    isGrantWeek2027ClassLine({ classRank: '#6', blueChip: '63%', commits: '27', avgRating: '90.2' }),
    false
  );
});

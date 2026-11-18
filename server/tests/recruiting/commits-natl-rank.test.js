'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { pinEastonRoyalHubSurface } = require('../../lib/recruiting-hub-cache');

function natlFromNote(row) {
  const m = String(row?.rankNote || row?.metaLine || '').match(/#(\d+)\s+natl/i);
  return m ? Number(m[1]) : 9999;
}

test('2027 hub-runtime commit cards are On3 Industry national-rank order', () => {
  const doc = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/recruiting/hub-runtime/2027/commits.json'), 'utf8')
  );
  const items = doc.items || [];
  assert.equal(items.length, 27);
  assert.equal(items[0].id, 'maxwell-hiller');
  assert.equal(items[1].id, 'easton-royal');
  assert.equal(items.some((p) => p.id === 'cain-van-norden'), false);
  let prev = 0;
  for (const row of items) {
    const n = natlFromNote(row);
    assert.ok(n >= prev, `${row.id} #${n} after #${prev}`);
    prev = n;
  }
});

test('Royal pin keeps the hero flip and does not move him to card 1', () => {
  const bundle = pinEastonRoyalHubSurface(
    {
      title: 'Florida Recruiting',
      subtitle: 'Who Florida is chasing — movement, board, and beat intel.',
      commits: [
        { id: 'maxwell-hiller', name: 'Maxwell Hiller', rankNote: '#4 natl' },
        { id: 'easton-royal', name: 'Easton Royal', rankNote: '#7 natl' },
        { id: 'raheem-floyd', name: 'Raheem Floyd', rankNote: '#94 natl' },
      ],
      movementFeed: [{ id: 'visit-tranard', name: 'Tranard Roberts', event: 'visit' }],
    },
    2027
  );
  assert.equal(bundle.commits[0].id, 'maxwell-hiller');
  assert.equal(bundle.commits[1].id, 'easton-royal');
  assert.match(bundle.subtitle, /Easton Royal flipped from Texas/);
  assert.equal(bundle.movementFeed[0].id, 'commit-easton-royal');
});

test('live 2027 hub HS commits stay national-rank order', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.DATABASE_URL;
  const store = require('../../lib/recruiting-store');
  const hub = await store.getHubHsCommits(2027);
  assert.equal(hub[0].slug, 'maxwell-hiller');
  assert.equal(hub[1].slug, 'easton-royal');
  let prev = 0;
  for (const p of hub) {
    const n = Number.parseInt(String(p.natlRank ?? p.natl ?? ''), 10) || 9999;
    assert.ok(n >= prev, `${p.slug} #${n} after #${prev}`);
    prev = n;
  }
});

test('web EliteCommitBoard sorts by national rank instead of leading Royal', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '../../../client/components/recruiting-hub/elite/EliteCommitBoard.tsx'),
    'utf8'
  );
  assert.match(src, /function sortCommitsByNatlRank/);
  assert.match(src, /commitNatlRank\(a\) - commitNatlRank\(b\)/);
  assert.doesNotMatch(src, /return \[existing \?\? EASTON_ROYAL_COMMIT, \.\.\.rest\]/);
});

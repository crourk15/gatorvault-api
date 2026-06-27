const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getEditorialPosition,
  applyEditorialPositionToPlayer,
  resolveFutureCastPosition,
  listEditorial2028YoungerProspects,
  EDITORIAL_2028_YOUNGER_PROSPECTS,
} = require('../../lib/recruiting-editorial-positions');

test('lists 19 editorial younger prospect slugs', () => {
  assert.equal(EDITORIAL_2028_YOUNGER_PROSPECTS.size, 19);
  assert.equal(listEditorial2028YoungerProspects().length, 19);
});

test('kaleb-ballard editorial position is TE', () => {
  const row = getEditorialPosition('kaleb-ballard', 2028);
  assert.equal(row?.pos, 'TE');
});

test('all 2028 allowlist slugs resolve editorial position from board seed', () => {
  const { ALLOWLIST_2028 } = require('../../lib/recruiting-target-allowlist');
  for (const slug of ALLOWLIST_2028) {
    const row = getEditorialPosition(slug, 2028);
    assert.ok(row?.pos, `missing board position for ${slug}`);
  }
});

test('andre-alexander editorial position is LB', () => {
  const row = getEditorialPosition('andre-alexander', 2028);
  assert.equal(row?.pos, 'LB');
});

test('kahmaree-crumity editorial position is CB with 3 stars', () => {
  const row = getEditorialPosition('kahmaree-crumity', 2028);
  assert.equal(row?.pos, 'CB');
  assert.equal(row?.stars, 3);
});

test('malakhi-dudley editorial position is OT at Heritage (GA)', () => {
  const row = getEditorialPosition('malakhi-dudley', 2028);
  assert.equal(row?.pos, 'OT');
  assert.equal(row?.school, 'Heritage High School, GA');
  assert.equal(row?.state, 'GA');
  assert.equal(row?.natlRank, 204);
});

test('applyEditorialPositionToPlayer fills missing pos from board seed', () => {
  const out = applyEditorialPositionToPlayer({
    slug: 'malakhi-dudley',
    classYear: 2028,
    school: 'Florida HS pipeline',
    state: 'FL',
  });
  assert.equal(out.pos, 'OT');
  assert.equal(out.position, 'OT');
  assert.equal(out.school, 'Heritage High School, GA');
  assert.equal(out.state, 'GA');
});

test('applyEditorialPositionToPlayer does not override On3-synced pos', () => {
  const out = applyEditorialPositionToPlayer({
    slug: 'malakhi-dudley',
    classYear: 2028,
    pos: 'OT',
    position: 'OT',
    on3Source: 'on3-allowlist-sync',
    school: 'Heritage High School, GA',
  });
  assert.equal(out.pos, 'OT');
});

test('applyEditorialPositionToPlayer does not override store pos with stale board value', () => {
  const out = applyEditorialPositionToPlayer({
    slug: 'tristin-gaines',
    classYear: 2028,
    pos: 'QB',
    on3Source: 'on3-board-sync',
  });
  assert.equal(out.pos, 'QB');
});

test('resolveFutureCastPosition prefers recruiting store over editorial board', () => {
  const pos = resolveFutureCastPosition({
    slug: 'pj-evans',
    classYear: 2028,
    recruiting: { pos: 'IOL' },
    seed: { pos: 'ATH' },
    rank: null,
    model: { position: 'WR' },
  });
  assert.equal(pos, 'IOL');
});

test('resolveFutureCastPosition falls back to board seed when store pos missing', () => {
  const pos = resolveFutureCastPosition({
    slug: 'kaleb-ballard',
    classYear: 2028,
    recruiting: null,
    seed: null,
    rank: null,
    model: null,
  });
  assert.equal(pos, 'TE');
});

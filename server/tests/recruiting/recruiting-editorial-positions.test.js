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

test('applyEditorialPositionToPlayer overrides ingest pos and school', () => {
  const out = applyEditorialPositionToPlayer({
    slug: 'malakhi-dudley',
    classYear: 2028,
    pos: 'QB',
    position: 'QB',
    school: 'Florida HS pipeline',
    state: 'FL',
  });
  assert.equal(out.pos, 'OT');
  assert.equal(out.position, 'OT');
  assert.equal(out.school, 'Heritage High School, GA');
  assert.equal(out.state, 'GA');
});

test('applyEditorialPositionToPlayer overrides tristin-gaines pos', () => {
  const out = applyEditorialPositionToPlayer({
    slug: 'tristin-gaines',
    classYear: 2028,
    pos: 'TE',
  });
  assert.equal(out.pos, 'QB');
});

test('resolveFutureCastPosition prefers editorial over store pos', () => {
  const pos = resolveFutureCastPosition({
    slug: 'pj-evans',
    classYear: 2028,
    recruiting: { pos: 'ATH' },
    seed: { pos: 'ATH' },
    rank: null,
    model: { position: 'WR' },
  });
  assert.equal(pos, 'IOL');
});

test('resolveFutureCastPosition ignores editorial for non-listed slug', () => {
  const pos = resolveFutureCastPosition({
    slug: 'kaleb-ballard',
    classYear: 2028,
    recruiting: { pos: 'QB' },
    seed: { pos: 'QB' },
    rank: null,
    model: null,
  });
  assert.equal(pos, 'QB');
});

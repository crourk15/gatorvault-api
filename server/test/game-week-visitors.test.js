/**
 * Run: node --test server/test/game-week-visitors.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  expectedVisitLabelForSlug,
  mergeExpectedVisitHistory,
  buildSlugLabelMap,
  visitorsPanelForGameId,
  attachExpectedVisitorsToGames,
} = require('../lib/game-week-visitors');

describe('game-week-visitors', () => {
  it('maps FAU and Ole Miss visitors to chase labels', () => {
    assert.equal(expectedVisitLabelForSlug('asher-ghioto'), 'Expected FAU visit · Sep 5');
    assert.equal(expectedVisitLabelForSlug('brysen-wright'), 'Expected Ole Miss visit · Sep 26');
    assert.equal(expectedVisitLabelForSlug('hudson-west'), 'Expected Ole Miss visit · Sep 26');
    assert.equal(expectedVisitLabelForSlug('not-a-real-slug'), null);
  });

  it('prepends Game Day badge with fan label', () => {
    const out = mergeExpectedVisitHistory('merrick-ham', [{ type: 'OV', label: 'OV' }]);
    assert.equal(out[0].type, 'Game Day');
    assert.equal(out[0].label, 'Expected Ole Miss visit · Sep 26');
    assert.equal(out[1].label, 'OV');
  });

  it('slug map has unique first-game wins', () => {
    const map = buildSlugLabelMap();
    assert.ok(map.size >= 20);
    assert.equal(map.get('asher-ghioto'), 'Expected FAU visit · Sep 5');
  });

  it('builds Game Week panel rows for FAU', () => {
    const panel = visitorsPanelForGameId('fau');
    assert.ok(panel);
    assert.equal(panel.gameId, 'fau');
    assert.ok(panel.visitors.length >= 5);
    assert.ok(panel.visitors.every((v) => v.slug && v.name));
    assert.match(String(panel.source || ''), /plans can change/i);
    const little = panel.visitors.find((v) => v.slug === 'zylen-little');
    assert.ok(little);
    assert.equal(little.position, 'DL');
    assert.match(String(little.school || ''), /Carrollwood/i);
    assert.equal(little.classYear, 2028);
  });

  it('includes Josiah Taylor on Ole Miss expected list', () => {
    const panel = visitorsPanelForGameId('olemiss');
    assert.ok(panel);
    assert.ok(panel.visitors.some((v) => v.slug === 'josiah-taylor'));
    assert.equal(expectedVisitLabelForSlug('josiah-taylor'), 'Expected FAU visit · Sep 5');
  });

  it('attaches expectedVisitors onto schedule games', () => {
    const games = attachExpectedVisitorsToGames([
      { id: 'fau', opp: 'FAU Owls', date: 'September 5, 2026' },
      { id: 'campbell', opp: 'Campbell', date: 'September 12, 2026' },
    ]);
    assert.ok(games[0].expectedVisitors?.visitors?.length);
    assert.equal(games[1].expectedVisitors, undefined);
  });
});

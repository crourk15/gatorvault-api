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
  isHomeVisitorGame,
} = require('../lib/game-week-visitors');

describe('game-week-visitors', () => {
  it('maps FAU and Ole Miss visitors to chase labels', () => {
    assert.equal(expectedVisitLabelForSlug('asher-ghioto'), 'FAU visit · Sep 5');
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
    assert.equal(map.get('asher-ghioto'), 'FAU visit · Sep 5');
  });

  it('builds Game Week panel rows for FAU', () => {
    const panel = visitorsPanelForGameId('fau');
    assert.ok(panel);
    assert.equal(panel.gameId, 'fau');
    assert.ok(panel.visitors.length >= 9);
    assert.ok(panel.visitors.every((v) => v.slug && v.name));
    assert.match(String(panel.source || ''), /plans can change/i);
    const little = panel.visitors.find((v) => v.slug === 'zylen-little');
    assert.ok(little);
    assert.equal(little.position, 'DL');
    assert.match(String(little.school || ''), /Carrollwood/i);
    assert.equal(little.classYear, 2028);
    // Alderman early list — open 2028 + elite 2029; no 2027 commits
    for (const slug of [
      'derrell-hines-jr',
      'dominick-harris-payne',
      'john-odwyer',
      'james-allen',
    ]) {
      assert.ok(
        panel.visitors.some((v) => v.slug === slug),
        `missing FAU visitor ${slug}`
      );
      assert.equal(expectedVisitLabelForSlug(slug), 'FAU visit · Sep 5');
    }
    assert.equal(
      panel.visitors.find((v) => v.slug === 'james-allen')?.classYear,
      2029
    );
    assert.ok(!panel.visitors.some((v) => v.slug === 'davin-davidson'));
  });

  it('lists Simmons + Alderman Campbell names as expected, not confirmed', () => {
    const panel = visitorsPanelForGameId('campbell');
    assert.ok(panel);
    assert.equal(panel.gameId, 'campbell');
    assert.deepEqual(
      panel.visitors.map((v) => v.slug),
      ['cyion-smith', 'man-robinson', 'timi-aliu', 'judah-gumbs', 'dully-littleton']
    );
    assert.match(String(panel.source || ''), /expected \/ planning, not confirmed on campus/i);
    assert.equal(expectedVisitLabelForSlug('dully-littleton'), 'Campbell visit · Sep 12');
    assert.equal(expectedVisitLabelForSlug('cyion-smith'), 'Campbell visit · Sep 12');
    assert.equal(expectedVisitLabelForSlug('man-robinson'), 'Campbell visit · Sep 12');
    assert.equal(expectedVisitLabelForSlug('zylen-little'), 'FAU visit · Sep 5');
    assert.doesNotMatch(String(panel.source || ''), /Simmons|Alderman|Rivals|Gators Online/i);
    const smith = panel.visitors.find((v) => v.slug === 'cyion-smith');
    assert.equal(smith.position, 'S');
    assert.equal(smith.classYear, 2028);
    const robinson = panel.visitors.find((v) => v.slug === 'man-robinson');
    assert.equal(robinson.position, 'CB');
    assert.equal(robinson.classYear, 2028);
    const aliu = panel.visitors.find((v) => v.slug === 'timi-aliu');
    assert.equal(aliu.position, 'OT');
    assert.equal(aliu.classYear, 2027);
    const littleton = panel.visitors.find((v) => v.slug === 'dully-littleton');
    assert.equal(littleton.classYear, 2029);
    assert.equal(littleton.position, 'TE');
  });

  it('does not list visitors on the Auburn road game', () => {
    assert.equal(isHomeVisitorGame({ gameId: 'fau', home: true }), true);
    assert.equal(isHomeVisitorGame({ gameId: 'auburn', home: true }), false);
    assert.equal(visitorsPanelForGameId('auburn'), null);
    assert.equal(expectedVisitLabelForSlug('jalanie-george'), null);
    const games = attachExpectedVisitorsToGames([
      { id: 'auburn', opp: 'Auburn Tigers', date: 'September 19, 2026' },
    ]);
    assert.equal(games[0].expectedVisitors, undefined);
  });

  it('includes Josiah Taylor on Ole Miss expected list', () => {
    const panel = visitorsPanelForGameId('olemiss');
    assert.ok(panel);
    assert.ok(panel.visitors.some((v) => v.slug === 'josiah-taylor'));
    assert.equal(expectedVisitLabelForSlug('josiah-taylor'), 'FAU visit · Sep 5');
    assert.ok(panel.visitors.some((v) => v.slug === 'antonio-thomas-jr'));
    assert.equal(expectedVisitLabelForSlug('antonio-thomas-jr'), 'Expected Ole Miss visit · Sep 26');
  });

  it('resolves Ole Miss identities and drops the Wessel alias', () => {
    const panel = visitorsPanelForGameId('olemiss');
    assert.ok(panel);
    assert.match(String(panel.source || ''), /expected \/ planning, not confirmed on campus/i);
    assert.equal(panel.visitors.filter((v) => /wessel/i.test(v.slug)).length, 1);
    assert.ok(!panel.visitors.some((v) => v.slug === 'j-c-wessel'));
    assert.ok(!panel.visitors.some((v) => v.slug === 'jdeion-jackson' || v.slug === 'j-deion-jackson'));

    const lawson = panel.visitors.find((v) => v.slug === 'omari-lawson');
    assert.equal(lawson?.name, 'Omari Lawson');
    assert.equal(lawson?.position, 'OT');
    assert.match(String(lawson?.school || ''), /Zarephath/i);

    const craig = panel.visitors.find((v) => v.slug === 'cj-craig-james');
    assert.equal(craig?.name, 'CJ Craig-James');
    assert.equal(craig?.position, 'S');

    const evans = panel.visitors.find((v) => v.slug === 'shamar-evans');
    assert.equal(evans?.name, 'Shamar Evans');
    assert.equal(evans?.position, 'LB');

    const winn = panel.visitors.find((v) => v.slug === 'ty-winn');
    assert.equal(winn?.name, 'Ty Winn');
    assert.equal(winn?.position, 'OT');

    const vickers = panel.visitors.find((v) => v.slug === 'izayah-vickers');
    assert.ok(vickers);
    assert.equal(vickers.position, 'CB');
    assert.equal(expectedVisitLabelForSlug('izayah-vickers'), 'Expected Ole Miss visit · Sep 26');

    const turner = panel.visitors.find((v) => v.slug === 'anthony-turner');
    assert.equal(turner?.name, 'Anthony Turner');
    assert.equal(turner?.position, 'QB');
    assert.equal(turner?.classYear, 2028);
  });

  it('attaches expectedVisitors onto schedule games', () => {
    const games = attachExpectedVisitorsToGames([
      { id: 'fau', opp: 'FAU Owls', date: 'September 5, 2026' },
      { id: 'campbell', opp: 'Campbell', date: 'September 12, 2026' },
    ]);
    assert.ok(games[0].expectedVisitors?.visitors?.length);
    assert.ok(games[1].expectedVisitors);
    assert.equal(games[1].expectedVisitors.visitors.length, 5);
    assert.match(String(games[1].expectedVisitors.source || ''), /expected \/ planning/i);
  });
});

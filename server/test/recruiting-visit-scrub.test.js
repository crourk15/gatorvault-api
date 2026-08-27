'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const {
  isDeniedVisit,
  scrubPlayerVisits,
  scrubPlayerVisitFields,
  scrubVisitLogRows,
  scrubCompetitorList,
  scrubOfferList,
  scrubHubPayload,
} = require('../lib/recruiting-visit-scrub');
const { buildVisits } = require('../lib/player-intelligence');
const store = require('../lib/recruiting-store');

describe('recruiting-visit-scrub (Tranard Auburn UV)', () => {
  it('denies Auburn visits for tranard-roberts only', () => {
    assert.equal(isDeniedVisit('tranard-roberts', 'Auburn Tigers'), true);
    assert.equal(isDeniedVisit('tranard-roberts', 'Auburn'), true);
    assert.equal(isDeniedVisit('tranard-roberts', 'Florida'), false);
    assert.equal(isDeniedVisit('easton-royal', 'Auburn Tigers'), false);
  });

  it('scrubs Auburn from player.visits', () => {
    const visits = scrubPlayerVisits('tranard-roberts', [
      { school: 'Florida', visitType: 'unofficial_visit', date: '2026-04-11' },
      { school: 'Auburn Tigers', visitType: 'unofficial_visit', date: '2025-11-29', source: 'on3' },
    ]);
    assert.equal(visits.length, 1);
    assert.equal(visits[0].school, 'Florida');
  });

  it('buildVisits never returns Tranard Auburn UV', () => {
    const out = buildVisits(
      {
        slug: 'tranard-roberts',
        visits: [
          { school: 'Auburn Tigers', visitType: 'unofficial_visit', date: '2025-11-29', source: 'on3' },
          { school: 'Florida', visitType: 'unofficial_visit', date: '2026-04-11', source: 'on3' },
        ],
      },
      [
        {
          playerSlug: 'tranard-roberts',
          school: 'Auburn',
          visitType: 'unofficial_visit',
          date: '2025-11-29',
        },
      ],
      []
    );
    assert.ok(out.every((v) => !/auburn/i.test(String(v.school || ''))));
    assert.ok(out.some((v) => /florida/i.test(String(v.school || ''))));
  });

  it('preservePlayerFields drops denied Auburn UV on merge', () => {
    const merged = store.preservePlayerFields(
      {
        slug: 'tranard-roberts',
        name: 'Tranard Roberts',
        visits: [{ school: 'Florida', visitType: 'unofficial_visit', date: '2026-04-11' }],
      },
      {
        slug: 'tranard-roberts',
        visits: [
          { school: 'Auburn Tigers', visitType: 'unofficial_visit', date: '2025-11-29', source: 'on3' },
        ],
      }
    );
    assert.ok(!(merged.visits || []).some((v) => /auburn/i.test(String(v.school || ''))));
  });

  it('normalizePlayer scrubs Auburn UV on read', () => {
    const p = store.normalizePlayer({
      slug: 'tranard-roberts',
      name: 'Tranard Roberts',
      pos: 'RB',
      classYear: 2027,
      visits: [
        { school: 'Auburn Tigers', visitType: 'unofficial_visit', date: '2025-11-29' },
        { school: 'Florida', visitType: 'unofficial_visit', date: '2026-04-11' },
      ],
    });
    assert.ok(!(p.visits || []).some((v) => /auburn/i.test(String(v.school || ''))));
    assert.equal((p.visits || []).length, 1);
  });

  it('scrubVisitLogRows + scrubPlayerVisitFields stay consistent', () => {
    const logs = scrubVisitLogRows([
      { playerSlug: 'tranard-roberts', school: 'Auburn Tigers', visitType: 'unofficial_visit' },
      { playerSlug: 'tranard-roberts', school: 'Florida', visitType: 'unofficial_visit' },
    ]);
    assert.equal(logs.length, 1);
    const player = scrubPlayerVisitFields({
      slug: 'tranard-roberts',
      visits: [{ school: 'Auburn Tigers' }],
      visitHistory: [{ school: 'Auburn' }, { school: 'Florida' }],
    });
    assert.equal((player.visits || []).length, 0);
    assert.equal((player.visitHistory || []).length, 1);
  });

  it('scrubs hub ticker, movement, battle/heat, and competitor Auburn', () => {
    const {
      isDeniedVisitTickerLine,
      scrubHubTickerLines,
      scrubMovementFeedItems,
    } = require('../lib/recruiting-visit-scrub');
    assert.equal(
      isDeniedVisitTickerLine('Tranard Roberts — unofficial visit · Auburn Tigers'),
      true
    );
    assert.equal(
      isDeniedVisitTickerLine('Tranard Roberts — unofficial visit · Florida'),
      false
    );
    const lines = scrubHubTickerLines([
      '2027 class trending nationally — UF at #8',
      'Tranard Roberts — unofficial visit · Auburn Tigers',
      'Tranard Roberts — unofficial visit · Florida',
    ]);
    assert.deepEqual(lines, [
      '2027 class trending nationally — UF at #8',
      'Tranard Roberts — unofficial visit · Florida',
    ]);
    const feed = scrubMovementFeedItems([
      {
        name: 'Tranard Roberts',
        event: 'visit',
        summary: 'unofficial visit · Auburn Tigers',
      },
      {
        name: 'Tranard Roberts',
        event: 'visit',
        summary: 'unofficial visit · Florida',
      },
    ]);
    assert.equal(feed.length, 1);
    assert.match(feed[0].summary, /Florida/i);

    const competitors = scrubCompetitorList('tranard-roberts', [
      { school: 'Auburn', score: 8 },
      { school: 'UCF', score: 1 },
    ]);
    assert.deepEqual(
      competitors.map((c) => c.school),
      ['UCF']
    );
    assert.equal(scrubOfferList('tranard-roberts', [{ school: 'Auburn Tigers' }, { school: 'Florida' }]).length, 1);

    const bundle = scrubHubPayload({
      ticker: ['Tranard Roberts — unofficial visit · Auburn Tigers'],
      movementFeed: [{ name: 'Tranard Roberts', summary: 'unofficial visit · Auburn Tigers' }],
      heatIndex: [
        {
          id: 'tranard-roberts',
          name: 'Tranard Roberts',
          battle: { uf: 74, competitor: 8, competitorName: 'Auburn' },
          competitors: [
            { school: 'Auburn', score: 8 },
            { school: 'UCF', score: 1 },
          ],
        },
      ],
      battleBoard: [
        {
          id: 'tranard-roberts',
          name: 'Tranard Roberts',
          competitors: [{ school: 'Auburn', score: 8 }, { school: 'UCF', score: 1 }],
        },
      ],
    });
    assert.equal(bundle.ticker.length, 0);
    assert.equal(bundle.movementFeed.length, 0);
    assert.equal(bundle.heatIndex[0].battle.competitorName, 'UCF');
    assert.deepEqual(
      bundle.battleBoard[0].competitors.map((c) => c.school),
      ['UCF']
    );
  });
});

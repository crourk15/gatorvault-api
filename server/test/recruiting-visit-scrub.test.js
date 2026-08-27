'use strict';

const assert = require('assert');
const { describe, it } = require('node:test');
const {
  isDeniedVisit,
  scrubPlayerVisits,
  scrubPlayerVisitFields,
  scrubVisitLogRows,
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
});

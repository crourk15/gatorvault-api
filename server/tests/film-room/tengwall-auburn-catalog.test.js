'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { loadLegacyVideoCatalog } = require('../../lib/film-room-legacy');
const { buildFilmRoomCatalog } = require('../../lib/film-room-feed');

describe('Tengwall Auburn run study lands on Film Breakdowns', () => {
  it('manual catalog includes the Auburn UF run tape only', () => {
    const items = loadLegacyVideoCatalog();
    const row = items.find((item) => item.youtubeId === 'MRjoBzMLD2s');
    assert.ok(row, 'MRjoBzMLD2s missing from Film Room catalog');
    assert.equal(row.source, 'Landon Tengwall');
    assert.match(row.title, /Run Game.*Auburn/i);
    assert.ok(
      !items.some((item) => item.youtubeId === 'UXOweKkBadI'),
      'Week 1 FAU Tengwall tape must stay off the catalog'
    );
  });

  it('film-room catalog hub lists it under Film Breakdown', () => {
    const catalog = buildFilmRoomCatalog();
    const breakdowns = (catalog.items || []).filter((row) => row.filmHub === 'Film Breakdown');
    const row = breakdowns.find((item) => item.youtubeId === 'MRjoBzMLD2s');
    assert.ok(row, 'Auburn Tengwall tape missing from Film Breakdown hub');
    assert.equal(row.source, 'Landon Tengwall');
    assert.ok(!breakdowns.some((item) => item.youtubeId === 'UXOweKkBadI'));
    assert.ok(!breakdowns.some((item) => item.filmHub === 'GatorVault Review'));
  });

  it('hub seed first-paints the Auburn Tengwall cut', () => {
    const seed = require('../../../client/lib/film-room-hub-seed.json');
    const ids = (seed.items || []).map((row) => row.youtubeId);
    assert.ok(ids.includes('MRjoBzMLD2s'));
    assert.ok(!ids.includes('UXOweKkBadI'));
  });
});

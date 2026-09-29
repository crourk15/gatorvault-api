'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { loadLegacyVideoCatalog } = require('../../lib/film-room-legacy');
const { buildFilmRoomCatalog } = require('../../lib/film-room-feed');

describe('Ole Miss Week 4 GNFP film lands on Film Breakdowns', () => {
  it('cache includes GNFP offense and defense cuts', () => {
    const items = loadLegacyVideoCatalog();
    const ids = items.map((row) => row.youtubeId);
    assert.ok(ids.includes('-7Q5Aerl9zU'));
    assert.ok(ids.includes('GuAWJ4iekco'));
    const offense = items.find((row) => row.youtubeId === '-7Q5Aerl9zU');
    const defense = items.find((row) => row.youtubeId === 'GuAWJ4iekco');
    assert.match(offense.title, /Offense vs\. Ole Miss/);
    assert.match(defense.title, /Defense vs\. Ole Miss/);
    assert.equal(offense.source, 'GNFP');
    assert.equal(defense.source, 'GNFP');
  });

  it('film-room catalog hub lists them under Film Breakdown', () => {
    const catalog = buildFilmRoomCatalog();
    const breakdowns = (catalog.items || []).filter((row) => row.filmHub === 'Film Breakdown');
    assert.ok(breakdowns.some((row) => row.youtubeId === '-7Q5Aerl9zU'));
    assert.ok(breakdowns.some((row) => row.youtubeId === 'GuAWJ4iekco'));
  });

  it('hub seed first-paints the GNFP Ole Miss cuts', () => {
    const seed = require('../../../client/lib/film-room-hub-seed.json');
    const ids = (seed.items || []).map((row) => row.youtubeId);
    assert.ok(ids.includes('-7Q5Aerl9zU'));
    assert.ok(ids.includes('GuAWJ4iekco'));
  });
});


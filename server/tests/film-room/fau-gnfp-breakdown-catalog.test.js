'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const { loadLegacyVideoCatalog } = require('../../lib/film-room-legacy');
const { buildFilmRoomCatalog } = require('../../lib/film-room-feed');

describe('FAU Week 1 GNFP film lands on Film Breakdowns', () => {
  it('manual catalog includes GNFP offense and defense cuts', () => {
    const items = loadLegacyVideoCatalog();
    const ids = items.map((row) => row.youtubeId);
    assert.ok(ids.includes('SPKKr6vhtZA'));
    assert.ok(ids.includes('-JTwuz-iJ_Q'));
    const offense = items.find((row) => row.youtubeId === 'SPKKr6vhtZA');
    const defense = items.find((row) => row.youtubeId === '-JTwuz-iJ_Q');
    assert.match(offense.title, /Offense vs\. FAU/);
    assert.match(defense.title, /Defense vs\. Florida Atlantic/);
    assert.equal(offense.source, 'GNFP');
    assert.equal(defense.source, 'GNFP');
    assert.doesNotMatch(JSON.stringify([offense, defense]), /Lagway/i);
  });

  it('film-room catalog hub lists them under Film Breakdown', () => {
    const catalog = buildFilmRoomCatalog();
    const breakdowns = (catalog.items || []).filter((row) => row.filmHub === 'Film Breakdown');
    assert.ok(breakdowns.some((row) => row.youtubeId === 'SPKKr6vhtZA'));
    assert.ok(breakdowns.some((row) => row.youtubeId === '-JTwuz-iJ_Q'));
    assert.ok(!breakdowns.some((row) => row.filmHub === 'GatorVault Review'));
  });

  it('hub seed first-paints the GNFP FAU cuts', () => {
    const seed = require('../../../client/lib/film-room-hub-seed.json');
    const ids = (seed.items || []).map((row) => row.youtubeId);
    assert.ok(ids.includes('SPKKr6vhtZA'));
    assert.ok(ids.includes('-JTwuz-iJ_Q'));
  });
});

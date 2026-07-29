/**
 * Film traits store + Copy Brief embedding.
 * Run: node --test server/test/film-traits-brief.test.js
 */
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const store = require('../lib/film-traits-store');
const {
  formatBriefText,
  formatFilmTraitsBlock,
  buildVaultAngle,
} = require('../lib/beat-brief-packet');

describe('film-traits-store', () => {
  it('loads seeded CJ Craig-James traits', () => {
    const entry = store.getFilmTraitsBySlug('cj-craig-james');
    assert.ok(entry);
    assert.match(entry.playerName, /Craig-James/i);
    assert.ok(Array.isArray(entry.traits) && entry.traits.length >= 2);
    assert.ok(entry.sources?.some((s) => /hudl/i.test(s.type || s.url || '')));
    assert.ok(entry.vaultFilmAngle);
  });

  it('resolves by player name', () => {
    const entry = store.resolveFilmTraits({ playerName: 'CJ Craig-James' });
    assert.ok(entry);
    assert.equal(entry.slug, 'cj-craig-james');
  });

  it('upserts a temporary player then restores seed file', () => {
    const dataPath = store.DATA_PATH;
    const before = fs.readFileSync(dataPath, 'utf8');
    try {
      const saved = store.upsertFilmTraits('test-film-player', {
        playerName: 'Test Film Player',
        position: 'WR',
        classYear: 2029,
        sources: [{ type: 'on3', url: 'https://www.on3.com/example', label: 'On3 clip' }],
        traits: ['Sudden release', 'Tracks over the shoulder'],
        vaultFilmAngle: 'Use suddenness vs press as the Vault edge.',
        doNotClaim: ['Do not invent YPR'],
        clipNotes: 'Short sample for unit test.',
      });
      assert.equal(saved.slug, 'test-film-player');
      assert.equal(store.getFilmTraitsBySlug('test-film-player')?.traits?.length, 2);
    } finally {
      fs.writeFileSync(dataPath, before, 'utf8');
    }
    assert.equal(store.getFilmTraitsBySlug('test-film-player'), null);
  });
});

describe('beat brief film section', () => {
  it('formats film block into paste text', () => {
    const film = store.getFilmTraitsBySlug('cj-craig-james');
    const block = formatFilmTraitsBlock(film);
    assert.match(block, /FILM \/ HIGHLIGHTS/);
    assert.match(block, /centerfield|length/i);
    assert.match(block, /hudl/i);

    const angle = buildVaultAngle({
      playerName: 'CJ Craig-James',
      research: { eventType: 'visit', ufPosition: 'tracking' },
      intelligence: null,
      beatRows: [],
      rivals: ['Alabama', 'Florida'],
      whyFlorida: 'Game-day visits + length.',
      player: {
        name: 'CJ Craig-James',
        position: 'S',
        classYear: 2028,
        natlRank: 83,
        posRank: 8,
        stateRank: 6,
        stars: 4,
        school: 'Parker',
        state: 'AL',
      },
      filmTraits: film,
    });
    assert.match(angle, /FILM|centerfield|length/i);

    const paste = formatBriefText({
      slug: 'cj-craig-james',
      playerName: 'CJ Craig-James',
      player: {
        classYear: 2028,
        position: 'S',
        stars: 4,
        school: 'Parker',
        state: 'AL',
        natlRank: 83,
        ufRpmPct: 3,
      },
      inspect: null,
      beatRows: [],
      research: { ufPosition: 'tracking', eventType: 'visit' },
      intelligence: null,
      whyFlorida: 'Florida process is game days; Alabama has backyard gravity.',
      vaultAngle: angle,
      rivals: ['Alabama'],
      filmTraits: film,
    });
    assert.match(paste, /FILM \/ HIGHLIGHTS/);
    assert.match(paste, /Vault film angle/);
    assert.match(paste, /Do not claim/);
    assert.match(paste, /Film \/ highlights: if FILM section/);
    assert.match(paste, /tape facts naturally/);
    assert.match(paste, /Show, don't announce|meta flex/i);
  });

  it('shows empty film placeholder when no traits', () => {
    const paste = formatBriefText({
      slug: 'nobody-on-file',
      playerName: 'Nobody',
      player: { classYear: 2028, position: 'LB' },
      inspect: null,
      beatRows: [],
      research: null,
      intelligence: null,
      whyFlorida: 'thin',
      vaultAngle: 'thin',
      rivals: [],
      filmTraits: null,
    });
    assert.match(paste, /No curated Hudl\/On3 film traits/);
  });

  it('seed file exists beside recruiting data', () => {
    const p = path.join(__dirname, '../data/recruiting/film-traits.json');
    assert.ok(fs.existsSync(p));
    const doc = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(doc.bySlug['cj-craig-james']);
  });
});

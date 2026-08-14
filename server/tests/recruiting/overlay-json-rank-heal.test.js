const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it, before, after } = require('node:test');

describe('overlayJsonIntelFields rank heal', () => {
  let tmpRoot;
  let prevDataDir;
  let store;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-rank-overlay-'));
    prevDataDir = process.env.GV_RECRUITING_DATA_DIR;
    process.env.GV_RECRUITING_DATA_DIR = tmpRoot;
    fs.writeFileSync(
      path.join(tmpRoot, 'players.json'),
      JSON.stringify([
        {
          slug: 'elias-pearl',
          name: 'Elias Pearl',
          natlRank: 91,
          posRank: 17,
          stateRank: 12,
          rating: 93.20398550724637,
          displayRating: 93.20398550724637,
        },
      ])
    );
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    store = require('../../lib/recruiting-store');
  });

  after(() => {
    if (prevDataDir == null) delete process.env.GV_RECRUITING_DATA_DIR;
    else process.env.GV_RECRUITING_DATA_DIR = prevDataDir;
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('heals stale Supabase pos/state/rating from players.json', () => {
    const [healed] = store.overlayJsonIntelFields([
      {
        slug: 'elias-pearl',
        name: 'Elias Pearl',
        natlRank: 91,
        posRank: 19,
        stateRank: 11,
        rating: 93.0,
      },
    ]);
    assert.equal(healed.posRank, 17);
    assert.equal(healed.stateRank, 12);
    assert.ok(Math.abs(Number(healed.rating) - 93.20398550724637) < 0.0001);
  });

  it('prefers JSON ranks even when numerically worse than Supabase', () => {
    const [healed] = store.overlayJsonIntelFields([
      {
        slug: 'elias-pearl',
        name: 'Elias Pearl',
        natlRank: 80,
        posRank: 10,
        stateRank: 8,
        rating: 94,
      },
    ]);
    assert.equal(healed.natlRank, 91);
    assert.equal(healed.posRank, 17);
    assert.equal(healed.stateRank, 12);
    assert.ok(Math.abs(Number(healed.rating) - 93.20398550724637) < 0.0001);
  });
});

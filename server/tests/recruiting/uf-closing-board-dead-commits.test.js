const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('247 open sync does not reopen committed-elsewhere rows (Cole → Georgia)', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-247-dead-'));
  fs.writeFileSync(
    path.join(tmp, 'players.json'),
    JSON.stringify(
      [
        {
          id: 'adryan-cole',
          slug: 'adryan-cole',
          name: 'Adryan Cole',
          pos: 'S',
          classYear: 2027,
          category: 'recruit',
          status: 'committed',
          committedTo: 'Georgia',
          verifiedCommit: true,
        },
        {
          id: 'open-target',
          slug: 'open-target',
          name: 'Open Target',
          pos: 'WR',
          classYear: 2027,
          category: 'target',
          status: 'uncommitted',
          committedTo: null,
        },
      ],
      null,
      2
    )
  );
  fs.writeFileSync(path.join(tmp, 'events.json'), '[]');
  fs.writeFileSync(path.join(tmp, 'rankings.json'), '[]');

  const prev = process.env.GV_RECRUITING_DATA_DIR;
  process.env.GV_RECRUITING_DATA_DIR = tmp;
  delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/uf-closing-board-247')];
  delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
  delete require.cache[require.resolve('../../lib/recruiting-target-filters')];

  const store = require('../../lib/recruiting-store');
  const { syncFloridaClosingBoardToStore, SNAPSHOT_PATH } = require('../../lib/uf-closing-board-247');
  const snapshotBackup = fs.existsSync(SNAPSHOT_PATH) ? fs.readFileSync(SNAPSHOT_PATH, 'utf8') : null;

  try {
    const result = await syncFloridaClosingBoardToStore({
      classYear: 2027,
      board: {
        open: [
          {
            slug: 'adryan-cole',
            name: 'Adryan Cole',
            pos: 'S',
            classYear: 2027,
          },
          {
            slug: 'open-target',
            name: 'Open Target',
            pos: 'WR',
            classYear: 2027,
          },
        ],
        committed: [
          {
            slug: 'adryan-cole',
            name: 'Adryan Cole',
            pos: 'S',
            classYear: 2027,
            committedTo: 'Georgia',
            status: 'committed',
          },
        ],
        fetchedAt: new Date().toISOString(),
      },
    });

    const cole = await store.getPlayerBySlug('adryan-cole');
    assert.equal(cole.committedTo, 'Georgia');
    assert.equal(cole.category, 'recruit');
    assert.equal(cole.verifiedCommit, true);
    assert.notEqual(String(cole.status || '').toLowerCase(), 'uncommitted');

    const board = await store.getBoard(2027);
    const slugs = (board.targets || []).map((p) => p.slug);
    assert.ok(!slugs.includes('adryan-cole'), 'Cole must not return on 2027 target board');
    assert.ok(!slugs.includes('open-target'), '247 offer-list row must not become a hunt target');
    assert.ok(result.ok);
  } finally {
    if (snapshotBackup != null) fs.writeFileSync(SNAPSHOT_PATH, snapshotBackup);
    if (prev == null) delete process.env.GV_RECRUITING_DATA_DIR;
    else process.env.GV_RECRUITING_DATA_DIR = prev;
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    delete require.cache[require.resolve('../../lib/uf-closing-board-247')];
  }
});

test('forced Hyppolite Miami + Sales Indiana scrub offer-list reopen', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-247-miami-'));
  fs.writeFileSync(
    path.join(tmp, 'players.json'),
    JSON.stringify(
      [
        {
          id: 'andre-hyppolite',
          slug: 'andre-hyppolite',
          name: 'Andre Hyppolite',
          pos: 'S',
          classYear: 2027,
          category: 'target',
          status: 'uncommitted',
          committedTo: null,
          boardSource: '247-uf-board-sync',
        },
        {
          id: 'monshun-sales',
          slug: 'monshun-sales',
          name: 'Monshun Sales',
          pos: 'WR',
          classYear: 2027,
          category: 'target',
          status: 'uncommitted',
          committedTo: null,
          boardSource: '247-uf-board-sync',
        },
        {
          id: 'tranard-roberts',
          slug: 'tranard-roberts',
          name: 'Tranard Roberts',
          pos: 'RB',
          classYear: 2027,
          category: 'target',
          status: 'uncommitted',
          committedTo: null,
        },
      ],
      null,
      2
    )
  );
  fs.writeFileSync(path.join(tmp, 'events.json'), '[]');
  fs.writeFileSync(path.join(tmp, 'rankings.json'), '[]');

  const prev = process.env.GV_RECRUITING_DATA_DIR;
  process.env.GV_RECRUITING_DATA_DIR = tmp;
  delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
  delete require.cache[require.resolve('../../lib/recruiting-store')];
  delete require.cache[require.resolve('../../lib/uf-closing-board-247')];
  delete require.cache[require.resolve('../../lib/recruiting-target-allowlist')];
  delete require.cache[require.resolve('../../lib/recruiting-target-filters')];

  const store = require('../../lib/recruiting-store');
  const { syncFloridaClosingBoardToStore, SNAPSHOT_PATH } = require('../../lib/uf-closing-board-247');
  const snapshotBackup = fs.existsSync(SNAPSHOT_PATH) ? fs.readFileSync(SNAPSHOT_PATH, 'utf8') : null;

  try {
    await syncFloridaClosingBoardToStore({
      classYear: 2027,
      board: {
        open: [
          {
            slug: 'andre-hyppolite',
            name: 'Andre Hyppolite',
            pos: 'S',
            classYear: 2027,
          },
          {
            slug: 'monshun-sales',
            name: 'Monshun Sales',
            pos: 'WR',
            classYear: 2027,
          },
          {
            slug: 'tranard-roberts',
            name: 'Tranard Roberts',
            pos: 'RB',
            classYear: 2027,
          },
        ],
        committed: [],
        fetchedAt: new Date().toISOString(),
      },
    });

    const hyp = await store.getPlayerBySlug('andre-hyppolite');
    assert.equal(hyp.committedTo, 'Miami');
    assert.equal(hyp.category, 'recruit');
    assert.equal(hyp.verifiedCommit, true);

    const sales = await store.getPlayerBySlug('monshun-sales');
    assert.equal(sales.committedTo, 'Indiana');
    assert.equal(sales.category, 'recruit');
    assert.equal(sales.verifiedCommit, true);

    const board = await store.getBoard(2027);
    const slugs = (board.targets || []).map((p) => p.slug);
    assert.ok(slugs.includes('tranard-roberts'));
    assert.ok(!slugs.includes('andre-hyppolite'));
    assert.ok(!slugs.includes('monshun-sales'));
  } finally {
    if (snapshotBackup != null) fs.writeFileSync(SNAPSHOT_PATH, snapshotBackup);
    if (prev == null) delete process.env.GV_RECRUITING_DATA_DIR;
    else process.env.GV_RECRUITING_DATA_DIR = prev;
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    delete require.cache[require.resolve('../../lib/uf-closing-board-247')];
  }
});

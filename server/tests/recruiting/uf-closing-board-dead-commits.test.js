const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

test('247 open sync does not reopen committed-elsewhere rows (Cole to Georgia)', async () => {
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

  const prev = process.env.RECRUITING_TEST_DATA_DIR;
  process.env.RECRUITING_TEST_DATA_DIR = tmp;
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

    assert.ok(result.skippedCommit >= 1);
    const cole = await store.getPlayerBySlug('adryan-cole');
    assert.equal(cole.committedTo, 'Georgia');
    assert.equal(cole.category, 'recruit');
    assert.equal(cole.verifiedCommit, true);
    assert.notEqual(String(cole.status || '').toLowerCase(), 'uncommitted');

    const board = await store.getBoard(2027);
    const slugs = (board.targets || []).map((p) => p.slug);
    assert.ok(!slugs.includes('adryan-cole'), 'Cole must not return on 2027 target board');
  } finally {
    if (snapshotBackup != null) fs.writeFileSync(SNAPSHOT_PATH, snapshotBackup);
    if (prev == null) delete process.env.RECRUITING_TEST_DATA_DIR;
    else process.env.RECRUITING_TEST_DATA_DIR = prev;
    delete require.cache[require.resolve('../../lib/recruiting-data-dir')];
    delete require.cache[require.resolve('../../lib/recruiting-store')];
    delete require.cache[require.resolve('../../lib/uf-closing-board-247')];
  }
});

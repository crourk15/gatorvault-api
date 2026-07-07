const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isUfHubCommit,
  normalizeCommitPlayerFields,
  removeSlugFromTargetBoard,
  applyCommitTargetCleanup,
} = require('../../lib/commit-target-cleanup');

test('isUfHubCommit requires Florida commitment', () => {
  assert.equal(isUfHubCommit({ status: 'committed', committedTo: 'Florida' }), true);
  assert.equal(isUfHubCommit({ status: 'committed', committedTo: 'Nebraska' }), false);
});

test('normalizeCommitPlayerFields flips target rows to recruit', () => {
  const out = normalizeCommitPlayerFields({
    slug: 'kamauri-whitfield',
    status: 'committed',
    committedTo: 'Florida',
    category: 'target',
  });
  assert.equal(out.category, 'recruit');
  assert.equal(out.status, 'committed');
});

test('removeSlugFromTargetBoard deletes stale seed row', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-board-'));
  const boardPath = path.join(tmp, 'data', 'recruiting', '2027-target-board.json');
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.writeFileSync(
    boardPath,
    JSON.stringify({
      version: 1,
      targets: [
        { slug: 'kamauri-whitfield', name: 'Kamauri Whitfield' },
        { slug: 'player-b', name: 'Player B' },
      ],
    })
  );

  const result = removeSlugFromTargetBoard('kamauri-whitfield', 2027, tmp);
  assert.equal(result.removed, true);
  const doc = JSON.parse(fs.readFileSync(boardPath, 'utf8'));
  assert.deepEqual(doc.targets.map((t) => t.slug), ['player-b']);
});

test('applyCommitTargetCleanup is idempotent for UF commits', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gv-cleanup-'));
  const boardPath = path.join(tmp, 'data', 'recruiting', '2027-target-board.json');
  fs.mkdirSync(path.dirname(boardPath), { recursive: true });
  fs.writeFileSync(
    boardPath,
    JSON.stringify({ version: 1, targets: [{ slug: 'player-a', name: 'Player A' }] })
  );

  const player = {
    slug: 'player-a',
    name: 'Player A',
    classYear: 2027,
    status: 'committed',
    committedTo: 'Florida',
    category: 'target',
  };
  const first = applyCommitTargetCleanup(player, { rootDir: tmp, quiet: true });
  const second = applyCommitTargetCleanup(player, { rootDir: tmp, quiet: true });
  assert.equal(first.removedFromBoards.length, 1);
  assert.equal(second.removedFromBoards.length, 0);
});
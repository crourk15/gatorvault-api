import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPositionNeedBoard } from './fc-position-need-board';
import type { RosterPlayer } from '@/lib/roster-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';

function roster(
  name: string,
  pos: string,
  year: string,
  slug = name.toLowerCase().replace(/\s+/g, '-')
): RosterPlayer {
  return { name, slug, pos, year, class: year } as RosterPlayer;
}

function ufCommit(name: string, position: string): RecruitingBoardPlayer {
  return {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    position,
    isCommittedToUF: true,
    committedTo: 'Florida',
  } as RecruitingBoardPlayer;
}

test('loaded WR room with 2 departing seniors is stable, not Needs help', () => {
  const players: RosterPlayer[] = [
    roster('W1', 'WR', 'Sr.'),
    roster('W2', 'WR', 'Sr.'),
    roster('W3', 'WR', 'Jr.'),
    roster('W4', 'WR', 'Jr.'),
    roster('W5', 'WR', 'So.'),
    roster('W6', 'WR', 'So.'),
    roster('W7', 'WR', 'Fr.'),
    roster('W8', 'WR', 'Fr.'),
    roster('W9', 'WR', 'Fr.'),
    roster('W10', 'WR', 'Fr.'),
    roster('W11', 'WR', 'So.'),
    roster('W12', 'WR', 'Jr.'),
    roster('W13', 'WR', 'So.'),
    roster('W14', 'WR', 'Fr.'),
  ];
  const board = buildPositionNeedBoard({
    roster: players,
    commits2027: [ufCommit('Commit WR', 'WR')],
    boardPlayers: [],
    boardClassYear: 2028,
  });
  const wr = board.rows.find((r) => r.position === 'WR');
  assert.ok(wr);
  assert.equal(wr!.shortfall, 0);
  assert.equal(wr!.needTier, 'stable');
  assert.ok(wr!.needScore < 55, `fat WR should not score as high need: ${wr!.needScore}`);
});

test('true shortfall EDGE room stays Must add / Needs help', () => {
  const players: RosterPlayer[] = [
    roster('E1', 'EDGE', 'Sr.'),
    roster('E2', 'EDGE', 'Jr.'),
  ];
  const board = buildPositionNeedBoard({
    roster: players,
    commits2027: [],
    boardPlayers: [],
    boardClassYear: 2028,
  });
  const edge = board.rows.find((r) => r.position === 'EDGE');
  assert.ok(edge);
  assert.ok(edge!.shortfall >= 2);
  assert.ok(
    edge!.needTier === 'critical' || edge!.needTier === 'high',
    `expected real EDGE need, got ${edge!.needTier}`
  );
});

test('depth-ok room with 3 departing is watch, not high', () => {
  const players: RosterPlayer[] = [
    roster('S1', 'S', 'Sr.'),
    roster('S2', 'S', 'Sr.'),
    roster('S3', 'S', 'Gr.'),
    roster('S4', 'S', 'Jr.'),
    roster('S5', 'S', 'So.'),
    roster('S6', 'S', 'Fr.'),
    roster('S7', 'S', 'Fr.'),
    roster('S8', 'S', 'So.'),
    roster('S9', 'S', 'Jr.'),
  ];
  const board = buildPositionNeedBoard({
    roster: players,
    commits2027: [ufCommit('Commit S', 'S')],
    boardPlayers: [],
    boardClassYear: 2028,
  });
  const s = board.rows.find((r) => r.position === 'S');
  assert.ok(s);
  assert.equal(s!.shortfall, 0);
  assert.equal(s!.needTier, 'watch');
});

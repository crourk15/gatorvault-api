/**
 * Closing Class Flip Watch — curated top-5 elsewhere-commits.
 * Mirrors server/lib/recruiting-target-allowlist.js FLIP_WATCH_2027.
 */
import type { FlipWatchRow } from '@/lib/futurecast-high-priority-api';

export const CLOSING_CLASS_FLIP_WATCH: FlipWatchRow[] = [
  {
    slug: 'jalen-brewster',
    name: 'Jalen Brewster',
    position: 'DL',
    stars: 5,
    committedTo: 'Texas Tech',
    committedShort: 'Texas Tech',
    ufProbability: null,
    visitStart: null,
    visitEnd: null,
    flipRank: 1,
  },
  {
    slug: 'easton-royal',
    name: 'Easton Royal',
    position: 'WR',
    stars: 5,
    committedTo: 'Texas',
    committedShort: 'Texas',
    ufProbability: null,
    visitStart: null,
    visitEnd: null,
    flipRank: 2,
  },
  {
    slug: 'keldrid-ben',
    name: 'Keldrid Ben',
    position: 'RB',
    stars: 4,
    committedTo: 'Oklahoma',
    committedShort: 'Oklahoma',
    ufProbability: null,
    visitStart: null,
    visitEnd: null,
    flipRank: 3,
  },
  {
    slug: 'andre-hyppolite',
    name: 'Andre Hyppolite',
    position: 'S',
    stars: 3,
    committedTo: 'Miami',
    committedShort: 'Miami',
    ufProbability: null,
    visitStart: null,
    visitEnd: null,
    flipRank: 4,
  },
  {
    slug: 'ace-alston',
    name: 'Ace Alston',
    position: 'CB',
    stars: 4,
    committedTo: 'Notre Dame',
    committedShort: 'Notre Dame',
    ufProbability: null,
    visitStart: null,
    visitEnd: null,
    flipRank: 5,
  },
];

/** Prefer live API rows; fall back to curated Closing Class list. */
export function resolveClosingClassFlipWatch(live?: FlipWatchRow[] | null): FlipWatchRow[] {
  if (Array.isArray(live) && live.length > 0) {
    return live.slice(0, 5).map((row, i) => ({
      ...row,
      flipRank: row.flipRank ?? i + 1,
      committedShort: row.committedShort || row.committedTo?.split(/\s+/)[0] || 'Other',
    }));
  }
  return CLOSING_CLASS_FLIP_WATCH;
}

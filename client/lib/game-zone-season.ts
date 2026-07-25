/**
 * Game Zone season — local ticket ledger, grading, weekly board.
 * Informational lines only; Vault Points are local rewards (no wagering).
 */

import type { BettingGame } from '@/lib/betting-api';
import type { ScheduleGame } from '@/lib/schedule-data';
import { addVaultPoints, hasOneTimeKey, markOneTimeKey } from '@/lib/vault-points';

export type CoverLean = 'cover' | 'no-cover';

export type GzSavedTicket = {
  gameKey: string;
  opponent: string;
  uf: number;
  opp: number;
  cover: CoverLean;
  spreadUf: number | null;
  lockedAt: string;
  weekLabel?: string;
};

export type GzTicketGrade = {
  gradedAt: string;
  finalUf: number;
  finalOpp: number;
  coverHit: boolean | null;
  exactScore: boolean;
  closeScore: boolean;
  pointsEarned: number;
  summary: string;
};

export type GzSeasonEntry = GzSavedTicket & {
  grade?: GzTicketGrade;
};

export type GzBoardRow = {
  id: string;
  name: string;
  points: number;
  covers: number;
  tickets: number;
  isYou?: boolean;
  sample?: boolean;
};

const SEASON_KEY = 'gv_gz_season_v1';
const FINAL_OVERRIDE_PREFIX = 'gv_gz_final_';

const LOCK_POINTS = 25;
const COVER_POINTS = 50;
const CLOSE_POINTS = 25;
const EXACT_POINTS = 100;

/** Sample board until live Nation board ships — labeled in UI. */
const SAMPLE_BOARD: GzBoardRow[] = [
  { id: 'sample-1', name: 'SwampScout', points: 200, covers: 2, tickets: 3, sample: true },
  { id: 'sample-2', name: 'OrangeNation', points: 150, covers: 2, tickets: 2, sample: true },
  { id: 'sample-3', name: 'TheSwampWatch', points: 100, covers: 1, tickets: 2, sample: true },
  { id: 'sample-4', name: 'GatorEdge', points: 75, covers: 1, tickets: 1, sample: true },
];

export function gzGameKey(g?: BettingGame | null): string {
  return String(g?.id || g?.game || g?.date || g?.kickoff || 'next').replace(/\s+/g, '_');
}

export function parseUfSpread(g?: BettingGame | null): number | null {
  if (!g?.spread) return null;
  if (typeof g.spread !== 'string' && typeof g.spread.uf === 'number') return g.spread.uf;
  const line = typeof g.spread === 'string' ? g.spread : g.spread.line || '';
  const m = String(line).match(/([+-]?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/** UF covers when finalUF + ufSpread > finalOpp. Push (equal) = not a hit. */
export function didUfCover(finalUf: number, finalOpp: number, spreadUf: number): boolean {
  return finalUf + spreadUf > finalOpp;
}

export function gradeTicket(
  ticket: Pick<GzSavedTicket, 'uf' | 'opp' | 'cover' | 'spreadUf'>,
  finalUf: number,
  finalOpp: number,
): Omit<GzTicketGrade, 'gradedAt' | 'pointsEarned'> & { pointsEarned: number } {
  const exactScore = ticket.uf === finalUf && ticket.opp === finalOpp;
  const closeScore =
    !exactScore &&
    Math.abs(ticket.uf - finalUf) + Math.abs(ticket.opp - finalOpp) <= 3;

  let coverHit: boolean | null = null;
  if (ticket.spreadUf != null && Number.isFinite(ticket.spreadUf)) {
    const ufCovered = didUfCover(finalUf, finalOpp, ticket.spreadUf);
    coverHit = ticket.cover === 'cover' ? ufCovered : !ufCovered;
  }

  let pointsEarned = 0;
  if (coverHit) pointsEarned += COVER_POINTS;
  if (exactScore) pointsEarned += EXACT_POINTS;
  else if (closeScore) pointsEarned += CLOSE_POINTS;

  const bits: string[] = [];
  if (coverHit === true) bits.push('Cover ✓');
  else if (coverHit === false) bits.push('Cover ✗');
  else bits.push('Cover n/a');
  if (exactScore) bits.push('Exact score');
  else if (closeScore) bits.push('Close score');
  else bits.push('Score miss');

  return {
    finalUf,
    finalOpp,
    coverHit,
    exactScore,
    closeScore,
    pointsEarned,
    summary: bits.join(' · '),
  };
}

export function resolveFinalScore(
  game: BettingGame | null | undefined,
  schedule: ScheduleGame | null | undefined,
  gameKey: string,
): { uf: number; opp: number; source: string } | null {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(FINAL_OVERRIDE_PREFIX + gameKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { uf?: number; opp?: number };
        if (typeof parsed.uf === 'number' && typeof parsed.opp === 'number') {
          return { uf: parsed.uf, opp: parsed.opp, source: 'override' };
        }
      }
    } catch {
      /* ignore */
    }
  }

  const status = String(game?.status || '').toLowerCase();
  const home = game?.homeTeam || game?.home || '';
  const away = game?.awayTeam || game?.away || '';
  if (
    (status.includes('final') || status === 'f') &&
    typeof game?.homeScore === 'number' &&
    typeof game?.awayScore === 'number'
  ) {
    const homeIsUf = /florida/i.test(home);
    const awayIsUf = /florida/i.test(away);
    if (homeIsUf) return { uf: game.homeScore, opp: game.awayScore, source: 'lines' };
    if (awayIsUf) return { uf: game.awayScore, opp: game.homeScore, source: 'lines' };
  }

  const sched = schedule as ScheduleGame & { finalUF?: number; finalOpp?: number };
  if (typeof sched?.finalUF === 'number' && typeof sched?.finalOpp === 'number') {
    return { uf: sched.finalUF, opp: sched.finalOpp, source: 'schedule' };
  }

  return null;
}

export function loadSeasonLedger(): GzSeasonEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SEASON_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GzSeasonEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSeasonLedger(entries: GzSeasonEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SEASON_KEY, JSON.stringify(entries));
  } catch {
    /* ignore */
  }
}

export function upsertLockedTicket(entry: GzSavedTicket): GzSeasonEntry[] {
  const ledger = loadSeasonLedger();
  const idx = ledger.findIndex((e) => e.gameKey === entry.gameKey);
  const next: GzSeasonEntry = { ...entry };
  if (idx >= 0) {
    // Keep grade if already graded.
    next.grade = ledger[idx].grade;
    ledger[idx] = next;
  } else {
    ledger.unshift(next);
  }
  saveSeasonLedger(ledger);
  return ledger;
}

export function removeSeasonTicket(gameKey: string): GzSeasonEntry[] {
  const ledger = loadSeasonLedger().filter((e) => e.gameKey !== gameKey);
  saveSeasonLedger(ledger);
  return ledger;
}

/** Grade ticket when final is available; award grade points once per game. */
export function ensureTicketGraded(
  gameKey: string,
  final: { uf: number; opp: number },
): GzSeasonEntry | null {
  const ledger = loadSeasonLedger();
  const idx = ledger.findIndex((e) => e.gameKey === gameKey);
  if (idx < 0) return null;
  const entry = ledger[idx];
  if (entry.grade) return entry;

  const partial = gradeTicket(entry, final.uf, final.opp);
  const gradeKey = `gv_gz_grade_${gameKey}`;
  let pointsEarned = 0;
  if (!hasOneTimeKey(gradeKey) && partial.pointsEarned > 0) {
    addVaultPoints(partial.pointsEarned);
    markOneTimeKey(gradeKey);
    pointsEarned = partial.pointsEarned;
  } else if (hasOneTimeKey(gradeKey)) {
    pointsEarned = partial.pointsEarned;
  }

  const graded: GzSeasonEntry = {
    ...entry,
    grade: {
      ...partial,
      pointsEarned,
      gradedAt: new Date().toISOString(),
    },
  };
  ledger[idx] = graded;
  saveSeasonLedger(ledger);
  return graded;
}

export function seasonStats(entries: GzSeasonEntry[]): {
  tickets: number;
  graded: number;
  covers: number;
  points: number;
  pending: number;
} {
  let covers = 0;
  let points = 0;
  let graded = 0;
  let pending = 0;
  for (const e of entries) {
    if (e.grade) {
      graded += 1;
      if (e.grade.coverHit) covers += 1;
      points += e.grade.pointsEarned;
    } else {
      pending += 1;
    }
  }
  // Lock points are separate; board uses grade points + lock credit estimate
  points += entries.length * LOCK_POINTS;
  return { tickets: entries.length, graded, covers, points, pending };
}

export function buildWeeklyBoard(entries: GzSeasonEntry[]): GzBoardRow[] {
  const stats = seasonStats(entries);
  const you: GzBoardRow = {
    id: 'you',
    name: 'You',
    points: stats.points,
    covers: stats.covers,
    tickets: stats.tickets,
    isYou: true,
  };

  const rows = [...SAMPLE_BOARD, you].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.covers !== a.covers) return b.covers - a.covers;
    return a.name.localeCompare(b.name);
  });

  return rows;
}

export { LOCK_POINTS, COVER_POINTS, CLOSE_POINTS, EXACT_POINTS };

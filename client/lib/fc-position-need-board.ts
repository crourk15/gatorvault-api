/**
 * FutureCast Lab — Board by need.
 * Ranks position rooms from roster depth + 2027 UF commits, then overlays
 * the active FutureCast board (2027 closing / 2028 discovery).
 */
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { RosterPlayer } from '@/lib/roster-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { isActiveUfTarget, isFloridaSchool } from '@/lib/recruiting-target-filters';
import { ufPctFromFc } from '@/components/futurecast/lab/fc-lab-types';

/** Fan-facing rooms used for need ranking (ST omitted). */
export type NeedBoardRoom =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'EDGE'
  | 'DL'
  | 'LB'
  | 'CB'
  | 'S';

export const NEED_BOARD_ROOMS: NeedBoardRoom[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'OL',
  'EDGE',
  'DL',
  'LB',
  'CB',
  'S',
];

/** Scholarship-depth floors — typical Power conference room targets. */
const SCHEME_MIN: Record<NeedBoardRoom, number> = {
  QB: 3,
  RB: 4,
  WR: 7,
  TE: 3,
  OL: 9,
  EDGE: 5,
  DL: 5,
  LB: 5,
  CB: 5,
  S: 4,
};

export type NeedTier = 'critical' | 'high' | 'watch' | 'stable';

export type BoardStrength = 'lean-uf' | 'battle' | 'behind' | 'empty';

export type NeedBoardPerson = {
  name: string;
  slug?: string;
  detail?: string;
};

export type PositionNeedRow = {
  position: NeedBoardRoom;
  needRank: number;
  needScore: number;
  needTier: NeedTier;
  schemeMin: number;
  rosterCount: number;
  departingSoon: number;
  returning: number;
  commits2027: number;
  projectedDepth: number;
  shortfall: number;
  boardTargets: number;
  avgUfPct: number | null;
  leanUf: number;
  battles: number;
  leanElsewhere: number;
  boardStrength: BoardStrength;
  reason: string;
  departing: NeedBoardPerson[];
  commits: NeedBoardPerson[];
  topTargets: NeedBoardPerson[];
};

export type PositionNeedBoard = {
  rows: PositionNeedRow[];
  boardClassYear: number;
  commitClassYear: number;
  confidence: 'high' | 'low';
  confidenceNote: string;
  methodNote: string;
  updatedAt: string;
};

function rawPos(value: string | null | undefined): string {
  return String(value || '')
    .toUpperCase()
    .trim()
    .replace(/[^A-Z]/g, '');
}

/** Map roster / recruiting / FutureCast codes into need-board rooms. */
export function normalizeNeedBoardRoom(
  pos: string | null | undefined
): NeedBoardRoom | null {
  const p = rawPos(pos);
  if (!p) return null;
  if (p === 'QB') return 'QB';
  if (p === 'RB' || p === 'FB') return 'RB';
  if (p === 'WR') return 'WR';
  if (p === 'TE') return 'TE';
  if (
    p === 'OL' ||
    p === 'OT' ||
    p === 'OG' ||
    p === 'C' ||
    p === 'IOL' ||
    p === 'LT' ||
    p === 'LG' ||
    p === 'RG' ||
    p === 'RT'
  ) {
    return 'OL';
  }
  if (p === 'EDGE' || p === 'DE' || p === 'END' || p === 'JACK') return 'EDGE';
  if (p === 'DL' || p === 'DT' || p === 'NT' || p === 'NOSE' || p === 'IDL') return 'DL';
  if (
    p === 'LB' ||
    p === 'ILB' ||
    p === 'MLB' ||
    p === 'MIKE' ||
    p === 'WILL' ||
    p === 'SAM' ||
    p === 'OLB'
  ) {
    return 'LB';
  }
  if (p === 'CB' || p === 'NB' || p === 'NICKEL' || p === 'STAR') return 'CB';
  if (p === 'S' || p === 'SAF' || p === 'FS' || p === 'SS' || p === 'SAFETY') return 'S';
  return null;
}

/** Infer remaining eligibility from roster class strings (Fr./So./Jr./Sr./Gr.). */
export function eligibilityYearsRemaining(classYear: string | null | undefined): number | null {
  const cls = String(classYear || '').trim();
  if (!cls) return null;
  if (/^Gr/i.test(cls)) return 0;
  if (/^R-Sr|^Sr/i.test(cls)) return 1;
  if (/^R-Jr|^Jr/i.test(cls)) return 2;
  if (/^R-So|^So/i.test(cls)) return 3;
  if (/^R-Fr|^Fr/i.test(cls)) return 4;
  return null;
}

function isUfCommit(p: RecruitingBoardPlayer): boolean {
  if (p.isCommittedToUF === true) return true;
  return isFloridaSchool(p.committedTo);
}

function boardPct(p: FutureCastPlayer | HighPriorityPlayer): number {
  if ('ufProbability' in p && p.ufProbability != null) return ufPctFromFc(p.ufProbability);
  if ('ufConfidence' in p && (p as FutureCastPlayer).ufConfidence != null) {
    return ufPctFromFc((p as FutureCastPlayer).ufConfidence);
  }
  return 0;
}

function classifyStrength(avg: number | null, targets: number): BoardStrength {
  if (targets <= 0 || avg == null) return 'empty';
  if (avg >= 67) return 'lean-uf';
  if (avg >= 34) return 'battle';
  return 'behind';
}

function needTier(score: number, shortfall: number, departing: number): NeedTier {
  if (score >= 90 || shortfall >= 3 || (shortfall >= 2 && departing >= 2)) return 'critical';
  if (score >= 55 || shortfall >= 2 || departing >= 2) return 'high';
  if (score >= 28 || shortfall >= 1 || departing >= 1) return 'watch';
  return 'stable';
}

function buildReason(row: Omit<PositionNeedRow, 'needRank' | 'reason'>): string {
  const parts: string[] = [];
  if (row.departingSoon > 0) {
    const names = row.departing
      .slice(0, 2)
      .map((d) => d.name)
      .join(', ');
    parts.push(
      `${row.departingSoon} likely gone after this cycle${names ? ` (${names})` : ''}`
    );
  }
  if (row.commits2027 === 0) {
    parts.push('no 2027 UF commits yet');
  } else {
    parts.push(
      `${row.commits2027} locked for 2027${
        row.commits[0] ? ` (${row.commits.map((c) => c.name).slice(0, 2).join(', ')})` : ''
      }`
    );
  }
  if (row.shortfall > 0) {
    parts.push(`${row.shortfall} below typical depth target (${row.schemeMin})`);
  } else {
    parts.push(`projected depth ${row.projectedDepth} meets target (${row.schemeMin})`);
  }
  if (row.boardTargets > 0) {
    const strength =
      row.boardStrength === 'lean-uf'
        ? 'leaning Florida'
        : row.boardStrength === 'battle'
          ? 'still battles'
          : row.boardStrength === 'behind'
            ? 'trailing on the board'
            : 'on the board';
    parts.push(
      `${row.boardTargets} active target${row.boardTargets === 1 ? '' : 's'} ${strength}${
        row.avgUfPct != null ? ` · ${row.avgUfPct}% avg Florida odds` : ''
      }`
    );
  } else {
    parts.push('no active FutureCast targets at this room yet');
  }
  return parts.join(' · ');
}

function emptyBucket(position: NeedBoardRoom) {
  return {
    position,
    roster: [] as NeedBoardPerson[],
    departing: [] as NeedBoardPerson[],
    commits: [] as NeedBoardPerson[],
    targets: [] as Array<NeedBoardPerson & { pct: number }>,
  };
}

export function buildPositionNeedBoard(input: {
  roster: RosterPlayer[];
  commits2027: RecruitingBoardPlayer[];
  boardPlayers: Array<FutureCastPlayer | HighPriorityPlayer>;
  boardClassYear: number;
  commitClassYear?: number;
  updatedAt?: string | null;
}): PositionNeedBoard {
  const commitClassYear = input.commitClassYear ?? 2027;
  const buckets = new Map(
    NEED_BOARD_ROOMS.map((pos) => [pos, emptyBucket(pos)] as const)
  );

  for (const p of input.roster) {
    const room = normalizeNeedBoardRoom(p.pos || p.position);
    if (!room) continue;
    const bucket = buckets.get(room)!;
    const yearsLeft = eligibilityYearsRemaining(p.year || p.class);
    const person: NeedBoardPerson = {
      name: p.name,
      slug: p.slug,
      detail: String(p.year || p.class || '').trim() || undefined,
    };
    bucket.roster.push(person);
    if (yearsLeft != null && yearsLeft <= 1) {
      bucket.departing.push(person);
    }
  }

  for (const p of input.commits2027) {
    if (!isUfCommit(p)) continue;
    const room = normalizeNeedBoardRoom(p.position || p.pos);
    if (!room) continue;
    buckets.get(room)!.commits.push({
      name: p.name,
      slug: p.slug,
      detail: '2027 commit',
    });
  }

  for (const p of input.boardPlayers) {
    if (!isActiveUfTarget(p)) continue;
    const room = normalizeNeedBoardRoom(p.position);
    if (!room) continue;
    const pct = boardPct(p);
    buckets.get(room)!.targets.push({
      name: p.name,
      slug: p.slug,
      detail: `${pct}% Florida odds`,
      pct,
    });
  }

  const hasRoster = input.roster.length > 0;
  const commitCount = input.commits2027.length;
  const confidence: PositionNeedBoard['confidence'] = hasRoster ? 'high' : 'low';

  const scored: PositionNeedRow[] = NEED_BOARD_ROOMS.map((position) => {
    const bucket = buckets.get(position)!;
    const schemeMin = SCHEME_MIN[position];
    const rosterCount = bucket.roster.length;
    const departingSoon = bucket.departing.length;
    const returning = Math.max(0, rosterCount - departingSoon);
    const commits2027 = bucket.commits.length;
    const projectedDepth = returning + commits2027;
    const shortfall = Math.max(0, schemeMin - projectedDepth);
    const targetsSorted = [...bucket.targets].sort((a, b) => b.pct - a.pct);
    const boardTargets = targetsSorted.length;
    const avgUfPct =
      boardTargets > 0
        ? Math.round(targetsSorted.reduce((acc, t) => acc + t.pct, 0) / boardTargets)
        : null;
    const leanUf = targetsSorted.filter((t) => t.pct >= 67).length;
    const battles = targetsSorted.filter((t) => t.pct >= 34 && t.pct < 67).length;
    const leanElsewhere = targetsSorted.filter((t) => t.pct > 0 && t.pct < 34).length;
    const boardStrength = classifyStrength(avgUfPct, boardTargets);

    const commitGap = Math.max(0, Math.min(schemeMin, 3) - commits2027);
    const needScore =
      shortfall * 42 +
      departingSoon * 18 +
      commitGap * 10 +
      battles * 4 +
      (boardTargets === 0 && shortfall > 0 ? 12 : 0) -
      Math.min(commits2027, 4) * 7;

    const rowBase = {
      position,
      needScore: Math.max(0, Math.round(needScore)),
      needTier: needTier(Math.max(0, needScore), shortfall, departingSoon),
      schemeMin,
      rosterCount,
      departingSoon,
      returning,
      commits2027,
      projectedDepth,
      shortfall,
      boardTargets,
      avgUfPct,
      leanUf,
      battles,
      leanElsewhere,
      boardStrength,
      departing: bucket.departing.slice(0, 6),
      commits: bucket.commits.slice(0, 6),
      topTargets: targetsSorted.slice(0, 3).map(({ name, slug, detail }) => ({
        name,
        slug,
        detail,
      })),
    };

    return {
      ...rowBase,
      needRank: 0,
      reason: buildReason(rowBase),
    };
  });

  scored.sort((a, b) => {
    if (b.needScore !== a.needScore) return b.needScore - a.needScore;
    if (b.shortfall !== a.shortfall) return b.shortfall - a.shortfall;
    return a.position.localeCompare(b.position);
  });

  const rows = scored.map((row, i) => ({ ...row, needRank: i + 1 }));

  return {
    rows,
    boardClassYear: input.boardClassYear,
    commitClassYear,
    confidence,
    confidenceNote:
      confidence === 'high'
        ? `Live roster loaded · ${commitCount} UF commit${commitCount === 1 ? '' : 's'} in the 2027 class.`
        : 'Waiting on the roster feed — need order not ready yet.',
    methodNote:
      'Need order = current roster depth, players with ≤1 year of eligibility left, and 2027 UF commits vs a typical depth target. Early NFL exits and unofficial portal rumors are not counted until the roster/commit feeds update.',
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function needTierLabel(tier: NeedTier): string {
  if (tier === 'critical') return 'Critical need';
  if (tier === 'high') return 'High need';
  if (tier === 'watch') return 'Watch';
  return 'Stable';
}

export function boardStrengthLabel(strength: BoardStrength): string {
  if (strength === 'lean-uf') return 'Lean Florida';
  if (strength === 'battle') return 'Battles';
  if (strength === 'behind') return 'Behind';
  return 'No targets';
}

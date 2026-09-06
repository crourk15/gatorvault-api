import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';
import {
  DEPTH_BY_PHASE,
  DEPTH_CHART_DEF,
  DEPTH_CHART_OFF,
  DEPTH_CHART_ST,
  type DepthChartRow,
  type DepthPhase,
} from './depth-chart-data';
import type { DepthChart, DepthChartPosition, DepthChartStatus } from './team-hub-types';

export type DepthChartBoardResponse = {
  ok?: boolean;
  version?: number;
  mode?: string;
  label?: string;
  subtitle?: string;
  updatedAt?: string;
  source?: string;
  offense?: DepthChartRow[];
  defense?: DepthChartRow[];
  specialTeams?: DepthChartRow[];
  byPhase?: Partial<Record<DepthPhase, DepthChartRow[]>>;
};

export type DepthChartBoard = {
  mode: string;
  label: string;
  subtitle: string;
  updatedAt: string | null;
  offense: DepthChartRow[];
  defense: DepthChartRow[];
  specialTeams: DepthChartRow[];
  byPhase: Record<DepthPhase, DepthChartRow[]>;
  depthChart: DepthChart;
};

function mapRowStatus(s: DepthChartRow['status']): DepthChartStatus {
  if (s === 'battle') return 'Battle';
  if (s === 'watch') return 'Watch';
  return 'Locked';
}

function rowToPosition(row: DepthChartRow, index: number): DepthChartPosition {
  const players: DepthChartPosition['players'] = [];
  if (row.s) {
    row.s.split('/').forEach((name, i) => {
      const yr = row.si.split('/')[i]?.trim() ?? row.si;
      players.push({ name: name.trim(), classYear: yr.trim() });
    });
  }
  if (row.b) {
    players.push({ name: row.b.trim(), classYear: row.bi.trim(), notes: 'Backup' });
  }
  if (row.third) {
    row.third.split('/').forEach((entry) => {
      const m = entry.trim().match(/^(.+?)\s*\((.+)\)$/);
      if (m) players.push({ name: m[1].trim(), classYear: m[2].trim(), notes: 'Depth' });
    });
  }
  return {
    id: `${row.pos}-${index}`,
    label: row.pos,
    status: mapRowStatus(row.status),
    players,
    analysis: row.analysis,
  };
}

export function buildDepthChartFromRows(
  offense: DepthChartRow[],
  defense: DepthChartRow[],
  specialTeams: DepthChartRow[]
): DepthChart {
  return {
    offense: offense.map(rowToPosition),
    defense: defense.map(rowToPosition),
    specialTeams: specialTeams.map(rowToPosition),
  };
}

export function fallbackDepthChartBoard(): DepthChartBoard {
  const offense = DEPTH_CHART_OFF.map((r) => ({ ...r }));
  const defense = DEPTH_CHART_DEF.map((r) => ({ ...r }));
  const specialTeams = DEPTH_CHART_ST.map((r) => ({ ...r }));
  return {
    mode: 'week-1',
    label: 'Official Week 1 two-deep',
    subtitle: 'Official sheet. Philo starts. Rooms marked Battle are still OR.',
    updatedAt: null,
    offense,
    defense,
    specialTeams,
    byPhase: {
      off: offense,
      def: defense,
      st: specialTeams,
    },
    depthChart: buildDepthChartFromRows(offense, defense, specialTeams),
  };
}

function normalizeRows(list: unknown, fallback: DepthChartRow[]): DepthChartRow[] {
  if (!Array.isArray(list) || !list.length) return fallback.map((r) => ({ ...r }));
  const out: DepthChartRow[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Partial<DepthChartRow>;
    const pos = String(r.pos || '').trim();
    const s = String(r.s || '').trim();
    if (!pos || !s) continue;
    const statusRaw = String(r.status || 'locked').toLowerCase();
    const status: DepthChartRow['status'] =
      statusRaw === 'battle' || statusRaw === 'watch' ? statusRaw : 'locked';
    out.push({
      pos,
      s,
      si: String(r.si || '').trim(),
      b: String(r.b || '').trim(),
      bi: String(r.bi || '').trim(),
      third: String(r.third || '').trim(),
      status,
      analysis: String(r.analysis || '').trim(),
    });
  }
  return out.length ? out : fallback.map((r) => ({ ...r }));
}

export function normalizeDepthChartBoard(data: DepthChartBoardResponse | null | undefined): DepthChartBoard {
  const fallback = fallbackDepthChartBoard();
  if (!data || data.ok === false) return fallback;
  const offense = normalizeRows(data.offense ?? data.byPhase?.off, fallback.offense);
  const defense = normalizeRows(data.defense ?? data.byPhase?.def, fallback.defense);
  const specialTeams = normalizeRows(data.specialTeams ?? data.byPhase?.st, fallback.specialTeams);
  if (!offense.length || !defense.length) return fallback;
  return {
    mode: String(data.mode || fallback.mode),
    label: String(data.label || fallback.label),
    subtitle: String(data.subtitle || fallback.subtitle),
    updatedAt: data.updatedAt ? String(data.updatedAt) : null,
    offense,
    defense,
    specialTeams,
    byPhase: { off: offense, def: defense, st: specialTeams },
    depthChart: buildDepthChartFromRows(offense, defense, specialTeams),
  };
}

/** Live depth board with static camp fallback. */
export async function fetchDepthChartBoard(): Promise<DepthChartBoard> {
  try {
    const data = await snapshotFirstFetch('/api/roster/depth-chart', () =>
      snapshotLiveFetch<DepthChartBoardResponse>('/api/roster/depth-chart')
    );
    return normalizeDepthChartBoard(data);
  } catch {
    return fallbackDepthChartBoard();
  }
}

/** Keep static DEPTH_BY_PHASE usable for first paint / offline. */
export function staticDepthByPhase(): Record<DepthPhase, DepthChartRow[]> {
  return DEPTH_BY_PHASE;
}

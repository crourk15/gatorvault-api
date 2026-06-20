import type { HeatCheckItem } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer, RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { MovementSummary } from '@/lib/recruiting-movement-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import {
  formatCompositeRating,
  formatRank,
  playerPos,
  playerRating,
} from '@/components/recruiting-hub/utils/formatRank';
import { playerProfilePath, recruitingProfileLifecycle } from '@/lib/player-routes';
import { ensurePlayerSlug } from '@/lib/slug';

export type RhClassMetrics = {
  classRank: string;
  blueChip: string;
  commits: string;
  avgRating: string;
  trendRank: string;
  trendBlueChip: string;
  trendCommits: string;
  trendRating: string;
};

export type RhCommitView = {
  id: string;
  name: string;
  position: string;
  rating: string;
  rankNote: string;
  commitDate: string;
  statusBadge?: string;
  href: string;
};

export type RhBattleView = {
  id: string;
  name: string;
  position: string;
  ufPercent: string;
  tag: string;
  note: string;
  movement: string;
};

export type RhPositionRoomView = {
  id: string;
  label: string;
  commits: number;
  targets: number;
  note: string;
};

function trendDisplay(trend: 'up' | 'down' | 'stable'): string {
  if (trend === 'up') return 'Rising';
  if (trend === 'down') return 'Falling';
  return 'Stable';
}

function trendFromDelta(delta: number): 'up' | 'down' | 'stable' {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function parseUfPct(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function futureCastTag(pct: number): string {
  if (pct >= 70) return 'Lean UF';
  if (pct >= 34) return 'Battle';
  return 'Lean Elsewhere';
}

function blueChipPct(players: RecruitingBoardPlayer[]): number | null {
  if (!players.length) return null;
  const blue = players.filter((p) => (p.stars ?? 0) >= 4).length;
  return Math.round((blue / players.length) * 100);
}

function avgRating(players: RecruitingBoardPlayer[]): number | null {
  const ratings = players
    .map((p) => p.rating ?? p.displayRating ?? playerRating(p))
    .filter((v): v is number => v != null && Number.isFinite(Number(v)) && Number(v) > 0);
  if (!ratings.length) return null;
  return ratings.reduce((sum, v) => sum + Number(v), 0) / ratings.length;
}

function formatCommitDate(player: RecruitingBoardPlayer): string {
  if (!player.commitDate) return 'Recently';
  const d = new Date(player.commitDate);
  if (Number.isNaN(d.getTime())) return player.commitDate;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function commitStatusBadge(player: RecruitingBoardPlayer): string | undefined {
  if (player.headliner) return 'Headliner';
  if ((player.stars ?? 0) >= 5) return 'Locked';
  if ((player.stars ?? 0) >= 4) return 'Solid';
  return undefined;
}

function rankNote(player: RecruitingBoardPlayer): string {
  const preview = player.skinny ?? player.notePreview ?? player.notes;
  if (preview?.trim()) return preview.trim();
  const pos = playerPos(player);
  return `NATL ${formatRank(player.natlRank ?? player.natl)} · POS ${formatRank(player.posRank)} (${pos})`;
}

export function buildClassMetrics(
  commits: RecruitingBoardPlayer[],
  targets: RecruitingBoardPlayer[],
  rankings: RecruitingBoardResponse['rankings'],
  staffDashboard: StaffDashboardResponse | null,
  movementSummary: MovementSummary | null
): RhClassMetrics {
  const pool = [...commits, ...targets];
  const risers = staffDashboard?.topRisers?.length ?? movementSummary?.rising ?? 0;
  const fallers = staffDashboard?.topFallers?.length ?? movementSummary?.falling ?? 0;
  const chip = blueChipPct(pool);
  const avg = avgRating(pool);

  return {
    classRank: rankings?.nationalRank != null ? `#${rankings.nationalRank}` : '—',
    blueChip: chip != null ? `${chip}%` : '—',
    commits: commits.length ? String(commits.length) : '—',
    avgRating: avg != null ? (avg > 10 ? avg.toFixed(1) : formatCompositeRating(avg) ?? '—') : '—',
    trendRank: trendDisplay(trendFromDelta(fallers - risers)),
    trendBlueChip: trendDisplay(chip != null && chip >= 70 ? 'up' : 'stable'),
    trendCommits: trendDisplay(commits.length > 0 ? 'up' : 'stable'),
    trendRating: trendDisplay(risers >= 2 ? 'up' : risers === 0 && fallers > 0 ? 'down' : 'stable'),
  };
}

export function buildCommitViews(commits: RecruitingBoardPlayer[]): RhCommitView[] {
  return commits.slice(0, 9).map((player) => {
    const ratingRaw = player.displayRating ?? player.rating ?? playerRating(player);
    const rating =
      ratingRaw != null
        ? ratingRaw > 10
          ? ratingRaw.toFixed(1)
          : formatCompositeRating(ratingRaw) ?? '—'
        : '—';

    return {
      id: player.slug || player.name,
      name: player.name,
      position: playerPos(player),
      rating,
      rankNote: rankNote(player),
      commitDate: formatCommitDate(player),
      statusBadge: commitStatusBadge(player),
      href: playerProfilePath(
        ensurePlayerSlug(player.slug, player.name),
        recruitingProfileLifecycle(player),
        true,
        player.name,
        'recruiting'
      ),
    };
  });
}

export function buildBattleViews(
  targets: RecruitingBoardPlayer[],
  rising: HeatCheckItem[],
  staffDashboard: StaffDashboardResponse | null
): RhBattleView[] {
  const fromTargets = [...targets]
    .map((p) => ({ player: p, pct: parseUfPct(p.ufProbability) }))
    .filter(({ pct }) => pct >= 34)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 4)
    .map(({ player, pct }) => ({
      id: player.slug || player.name,
      name: player.name,
      position: playerPos(player),
      ufPercent: `${pct}%`,
      tag: futureCastTag(pct),
      note: player.notePreview ?? player.notes ?? player.skinny ?? 'Key battle on the board.',
      movement:
        player.movementDirection === 'up'
          ? 'Trending up for UF'
          : player.movementDirection === 'down'
            ? 'Trending down'
            : pct >= 70
              ? 'Stable UF lead'
              : 'Holding steady',
    }));

  if (fromTargets.length >= 4) return fromTargets;

  const heatItems = [...rising].slice(0, 6 - fromTargets.length).map((item, idx) => ({
    id: item.playerSlug || item.playerName || String(idx),
    name: item.playerName,
    position: '—',
    ufPercent: '—',
    tag: 'Battle',
    note: item.headline ?? item.triggerLabel ?? 'Movement heating up.',
    movement: item.direction === 'rising' ? 'Trending up' : 'Cooling',
  }));

  const staffBattles = (staffDashboard?.topRisers ?? [])
    .slice(0, Math.max(0, 6 - fromTargets.length - heatItems.length))
    .map((p, idx) => ({
      id: p.id || p.slug || String(idx),
      name: p.name,
      position: '—',
      ufPercent: p.ufFitScore != null ? `${Math.round(p.ufFitScore * 100)}%` : '—',
      tag: 'Lean UF',
      note: 'Staff dashboard riser — momentum building.',
      movement: (p.delta7d ?? p.delta ?? 0) >= 0 ? 'Trending up' : 'Trending down',
    }));

  return [...fromTargets, ...heatItems, ...staffBattles].slice(0, 6);
}

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH', 'K', 'P'];

function normalizePos(raw: string): string {
  const p = raw.toUpperCase().trim();
  if (p === 'EDGE' || p === 'DE' || p === 'DT') return 'DL';
  return p;
}

export function buildPositionRooms(
  commits: RecruitingBoardPlayer[],
  targets: RecruitingBoardPlayer[]
): RhPositionRoomView[] {
  const rooms = new Map<string, { commits: number; targets: number }>();

  for (const player of commits) {
    const label = normalizePos(playerPos(player));
    const entry = rooms.get(label) ?? { commits: 0, targets: 0 };
    entry.commits += 1;
    rooms.set(label, entry);
  }

  for (const player of targets) {
    const tier = player.tier;
    if (tier !== 'TOP' && tier !== 'HIGH') continue;
    const label = normalizePos(playerPos(player));
    const entry = rooms.get(label) ?? { commits: 0, targets: 0 };
    entry.targets += 1;
    rooms.set(label, entry);
  }

  const sorted = [...rooms.entries()].sort((a, b) => {
    const ai = POSITION_ORDER.indexOf(a[0]);
    const bi = POSITION_ORDER.indexOf(b[0]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return sorted.slice(0, 8).map(([label, stats]) => ({
    id: label,
    label,
    commits: stats.commits,
    targets: stats.targets,
    note:
      stats.commits >= 2
        ? 'Room filling in'
        : stats.targets >= 2
          ? 'Active battles'
          : 'Needs attention',
  }));
}

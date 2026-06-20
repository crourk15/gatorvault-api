import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { RecruitingSnapshot, HomeBundle } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import type { LivePanelProps } from '@/lib/gatornation-live-types';

const NEXT_GAME_ISO = '2026-09-05T19:45:00-04:00';

export type HomeGameDayView = {
  opponent: string;
  opponentAbbr: string;
  dateLabel: string;
  countdownLabel: string;
};

export type HomeRecruitingMetricsView = {
  classRank: string;
  blueChip: string;
  commits: string;
  avgRating: string;
};

export type HomeFutureCastTargetView = {
  id: string;
  name: string;
  position: string;
  ufPercent: string;
};

export type HomeBeatPostView = {
  id: string;
  writerName: string;
  outlet: string;
  text: string;
  timestamp: string;
  xUrl: string;
  badge?: string;
};

export function nextScheduleGame(): ScheduleGame {
  return SCHEDULE_GAMES[0] ?? {
    id: 'fau',
    label: 'Sep 5 vs FAU',
    opp: 'FAU Owls',
    date: 'September 5, 2026 · 7:45 PM ET',
    venue: 'Ben Hill Griffin Stadium',
    ufPct: 94,
    keys: [],
    swing: [],
    film: '',
    pred: '',
  };
}

export function formatKickoffCountdown(iso = NEXT_GAME_ISO): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Kickoff';

  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export function buildGameDayView(): HomeGameDayView {
  const game = nextScheduleGame();
  const abbr = game.opp.split(' ')[0]?.slice(0, 3).toUpperCase() ?? 'OPP';
  return {
    opponent: game.opp,
    opponentAbbr: abbr,
    dateLabel: game.date,
    countdownLabel: formatKickoffCountdown(),
  };
}

function ufPctFromDelta(delta: number | null | undefined): number {
  return Math.min(99, Math.max(20, 55 + (delta ?? 0) * 2));
}

export function buildRecruitingMetricsView(
  recruiting: RecruitingSnapshot | null,
  board: RecruitingBoardResponse | null
): HomeRecruitingMetricsView {
  const commits = board?.commits ?? [];
  const ratings = commits
    .map((p) => p.displayRating ?? p.rating ?? p.vaultGrade)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const avgRating =
    ratings.length > 0
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : '—';
  const blueChipCount = commits.filter((p) => (p.stars ?? 0) >= 4).length;
  const blueChipPct =
    commits.length > 0 ? `${Math.round((blueChipCount / commits.length) * 100)}%` : '—';

  return {
    classRank: recruiting?.classRank != null ? `#${recruiting.classRank}` : '—',
    blueChip: blueChipPct,
    commits: String(recruiting?.commits ?? commits.length ?? 0),
    avgRating,
  };
}

export function buildFutureCastTargets(
  movement: StaffDashboardResponse | null,
  board: RecruitingBoardResponse | null
): HomeFutureCastTargetView[] {
  const fromBoard = (board?.targets ?? [])
    .slice(0, 3)
    .map((p) => ({
      id: p.slug,
      name: p.name,
      position: p.position ?? p.pos ?? '—',
      ufPercent:
        p.ufProbability != null
          ? `${Math.round(p.ufProbability <= 1 ? p.ufProbability * 100 : p.ufProbability)}%`
          : '—',
    }));

  if (fromBoard.length >= 3) return fromBoard;

  const risers = [...(movement?.topRisers ?? [])]
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 3)
    .map((p) => ({
      id: p.id,
      name: p.name,
      position: '—',
      ufPercent: `${ufPctFromDelta(p.delta)}%`,
    }));

  return risers.length ? risers : fromBoard;
}

function formatBeatTime(ts?: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d
    .toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    .toUpperCase();
}

export function buildBeatPosts(items: LivePanelProps['items']): HomeBeatPostView[] {
  return items.slice(0, 3).map((item, idx) => ({
    id: `${item.writerName ?? item.source ?? 'beat'}_${idx}`,
    writerName: item.writerName || item.handle || 'Beat Writer',
    outlet: item.source || 'Beat',
    text: item.text,
    timestamp: formatBeatTime(item.timestamp),
    xUrl: item.url || '/gator-nation-live',
    badge: item.source ? item.source.toUpperCase() : 'BEAT',
  }));
}

export function opponentInitials(opp: string): string {
  const parts = opp.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return opp.slice(0, 2).toUpperCase();
}

export function avatarInitials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

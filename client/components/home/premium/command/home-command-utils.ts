import type { RecruitingSnapshot } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type { RecruitingBoardResponse, RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { FutureCastHomeResponse } from '@/lib/futurecast-home-api';
import type { FeedPrediction } from '@/lib/predictions-api';
import type { LivePanelProps } from '@/lib/gatornation-live-types';
import type { BeatIntelItem, HighPriorityIntelItem } from '@/lib/recruiting-ui-api';
import type { MovementIntelResponse } from '@/lib/movement-intel-types';
import { movementDelta7d } from '@/lib/movement-intel-types';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';

export const NEXT_GAME_KICKOFF_ISO = '2026-09-05T19:45:00-04:00';

const NEXT_GAME = SCHEDULE_GAMES[0];
const RIVAL_OPPONENT_IDS = new Set(['fsu', 'uga', 'auburn', 'miami']);

export type MetricTrend = 'up' | 'down' | 'stable';

export type HomeMetricBlock = {
  label: string;
  value: string;
  trend: MetricTrend;
  trendLabel: string;
  sparkline: number[];
};

export type HomeGameDayView = {
  opponent: string;
  opponentShort: string;
  dateLabel: string;
  kickoffIso: string;
  isRival: boolean;
};

export type HomeRecruitingMetricsView = {
  classRank: string;
  blueChip: string;
  commits: string;
  avgRating: string;
  updatedLabel: string;
  blocks: HomeMetricBlock[];
};

export type HomeFutureCastTargetView = {
  id: string;
  name: string;
  position: string;
  ufPercent: string;
  ufPctNum: number;
  tag: string;
  movement: MetricTrend;
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

function trendFromDelta(delta: number): MetricTrend {
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function trendLabel(trend: MetricTrend): string {
  if (trend === 'up') return '↑ Rising';
  if (trend === 'down') return '↓ Falling';
  return '→ Stable';
}

function buildSparkline(base: number, trend: MetricTrend): number[] {
  const points = 7;
  const values: number[] = [];
  for (let i = 0; i < points; i += 1) {
    const progress = i / (points - 1);
    const drift = trend === 'up' ? progress * 12 : trend === 'down' ? (1 - progress) * 12 : 0;
    values.push(Math.max(0, Math.round(base - 6 + drift + (i % 2 === 0 ? 1 : 0))));
  }
  return values;
}

function futureCastTag(pct: number): string {
  if (pct >= 70) return 'Lean UF';
  if (pct >= 34) return 'Battle';
  return 'Lean Elsewhere';
}

function parseUfPct(player: RecruitingBoardPlayer): number {
  const raw = player.ufProbability;
  if (raw == null || !Number.isFinite(Number(raw))) return 0;
  const num = Number(raw);
  return Math.min(100, Math.max(0, Math.round(num <= 1 ? num * 100 : num)));
}

function boardPlayers(board: RecruitingBoardResponse | null): RecruitingBoardPlayer[] {
  if (!board) return [];
  if (board.players?.length) return board.players;
  const fromTiers = board.tiers?.flatMap((tier) => tier.players) ?? [];
  if (fromTiers.length) return fromTiers;
  return [...(board.targets ?? []), ...(board.commits ?? [])];
}

function avgRating(players: RecruitingBoardPlayer[]): number | null {
  const ratings = players
    .map((p) => p.rating ?? p.displayRating ?? p.vaultGrade)
    .filter((v): v is number => v != null && Number.isFinite(Number(v)));
  if (!ratings.length) return null;
  return ratings.reduce((sum, v) => sum + Number(v), 0) / ratings.length;
}

function blueChipPct(players: RecruitingBoardPlayer[]): number | null {
  if (!players.length) return null;
  const blue = players.filter((p) => (p.stars ?? 0) >= 4).length;
  return Math.round((blue / players.length) * 100);
}

export function opponentInitials(opponent: string): string {
  const parts = opponent.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return opponent.slice(0, 3).toUpperCase();
}

export function avatarInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function buildGameDayView(): HomeGameDayView {
  return {
    opponent: NEXT_GAME.opp,
    opponentShort: opponentInitials(NEXT_GAME.opp),
    dateLabel: NEXT_GAME.date,
    kickoffIso: NEXT_GAME_KICKOFF_ISO,
    isRival: RIVAL_OPPONENT_IDS.has(NEXT_GAME.id),
  };
}

export type HomeTrustTickerInput = {
  hubTicker: string[];
  hpIntel: HighPriorityIntelItem[];
  movement: MovementIntelResponse | null;
};

const HOME_TICKER_FALLBACKS = [
  '2027 class trending nationally — UF in the mix',
  'FutureCast leans UF for multiple blue-chip targets',
  'Staff locked in for summer evals and camps',
  'GatorNation Live — real-time pulse from the Swamp',
] as const;

/** Postgres-backed hero ticker — hub ticker, high-priority intel, movement alerts. */
export function buildHeroTickerFromTrust(input: HomeTrustTickerInput): string[] {
  const fromHub = input.hubTicker.map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const fromHp = input.hpIntel
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .slice(0, 2);
  const fromAlerts = (input.movement?.alerts ?? [])
    .map((alert) => {
      const detail = alert.detail?.trim();
      if (!detail) return '';
      return alert.player ? `${alert.player}: ${detail}` : detail;
    })
    .filter(Boolean)
    .slice(0, 2);
  const fromRisers = (input.movement?.risers ?? [])
    .slice(0, 2)
    .map((player) => {
      const ufPct = Math.round(player.ufProb <= 1 ? player.ufProb * 100 : player.ufProb);
      return `${player.name} rising — UF at ${ufPct}%`;
    });

  const combined = [...fromHub, ...fromHp, ...fromAlerts, ...fromRisers];
  const unique = [...new Set(combined)].slice(0, 6);
  if (unique.length > 0) return unique;
  return [...HOME_TICKER_FALLBACKS];
}

export function mapClassMetricsToHomeView(
  metrics: {
    classRank?: string;
    blueChip?: string;
    commits?: string;
    avgRating?: string;
    trendRank?: string;
    trendBlueChip?: string;
    trendCommits?: string;
    trendRating?: string;
    sparklines?: {
      classRank?: number[];
      blueChip?: number[];
      commits?: number[];
      avgRating?: number[];
    };
    meta?: { lastUpdated?: string; generatedAt?: string };
  } | null
): HomeRecruitingMetricsView {
  if (!metrics) {
    return buildRecruitingMetricsView(null, null, null);
  }

  const trendFromStr = (s?: string): MetricTrend => {
    if (!s) return 'stable';
    const lower = s.toLowerCase();
    if (lower.includes('rise') || lower === 'up') return 'up';
    if (lower.includes('fall') || lower === 'down') return 'down';
    return 'stable';
  };

  const classRank = metrics.classRank ?? '—';
  const blueChip = metrics.blueChip ?? '—';
  const commits = metrics.commits ?? '—';
  const avgRatingLabel = metrics.avgRating ?? '—';
  const classTrend = trendFromStr(metrics.trendRank);
  const blueChipTrend = trendFromStr(metrics.trendBlueChip);
  const commitTrend = trendFromStr(metrics.trendCommits);
  const ratingTrend = trendFromStr(metrics.trendRating);

  const updatedAt = metrics.meta?.lastUpdated ?? metrics.meta?.generatedAt;
  const updatedLabel = updatedAt
    ? `Updated ${new Date(updatedAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : 'Updated recently';

  const sparks = metrics.sparklines ?? {};

  return {
    classRank,
    blueChip,
    commits,
    avgRating: avgRatingLabel,
    updatedLabel,
    blocks: [
      {
        label: 'Class rank',
        value: classRank,
        trend: classTrend,
        trendLabel: trendLabel(classTrend),
        sparkline: sparks.classRank?.length ? sparks.classRank : buildSparkline(10, classTrend),
      },
      {
        label: 'Blue chip %',
        value: blueChip,
        trend: blueChipTrend,
        trendLabel: trendLabel(blueChipTrend),
        sparkline: sparks.blueChip?.length ? sparks.blueChip : buildSparkline(60, blueChipTrend),
      },
      {
        label: 'Commits',
        value: commits,
        trend: commitTrend,
        trendLabel: trendLabel(commitTrend),
        sparkline: sparks.commits?.length ? sparks.commits : buildSparkline(18, commitTrend),
      },
      {
        label: 'Avg rating',
        value: avgRatingLabel,
        trend: ratingTrend,
        trendLabel: trendLabel(ratingTrend),
        sparkline: sparks.avgRating?.length ? sparks.avgRating : buildSparkline(10, ratingTrend),
      },
    ],
  };
}

export function buildRecruitingMetricsView(
  recruiting: RecruitingSnapshot | null,
  board: RecruitingBoardResponse | null,
  movement: StaffDashboardResponse | null
): HomeRecruitingMetricsView {
  const players = boardPlayers(board);
  const risers = movement?.topRisers?.length ?? 0;
  const fallers = movement?.topFallers?.length ?? 0;
  const classTrend = trendFromDelta(fallers - risers);
  const commitTrend: MetricTrend = (recruiting?.commits ?? 0) > 0 ? 'up' : 'stable';
  const ratingTrend: MetricTrend = risers >= 2 ? 'up' : risers === 0 && fallers > 0 ? 'down' : 'stable';

  const rankNum = recruiting?.classRank ?? board?.rankings?.nationalRank ?? null;
  const chipPct = blueChipPct(players);
  const blueChipTrend: MetricTrend = chipPct != null && chipPct >= 70 ? 'up' : 'stable';
  const avg = avgRating(players);

  const classRank = rankNum != null ? `#${rankNum}` : '—';
  const blueChip = chipPct != null ? `${chipPct}%` : '—';
  const commits = recruiting?.commits != null ? String(recruiting.commits) : '—';
  const avgRatingLabel = avg != null ? avg.toFixed(1) : '—';

  const updatedLabel = movement?.lastUpdated
    ? `Updated ${new Date(movement.lastUpdated).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : 'Updated recently';

  return {
    classRank,
    blueChip,
    commits,
    avgRating: avgRatingLabel,
    updatedLabel,
    blocks: [
      {
        label: 'Class rank',
        value: classRank,
        trend: classTrend,
        trendLabel: trendLabel(classTrend),
        sparkline: buildSparkline(rankNum ?? 10, classTrend === 'up' ? 'down' : classTrend),
      },
      {
        label: 'Blue chip %',
        value: blueChip,
        trend: blueChipTrend,
        trendLabel: trendLabel(blueChipTrend),
        sparkline: buildSparkline(chipPct ?? 60, blueChipTrend),
      },
      {
        label: 'Commits',
        value: commits,
        trend: commitTrend,
        trendLabel: trendLabel(commitTrend),
        sparkline: buildSparkline(recruiting?.commits ?? 18, commitTrend),
      },
      {
        label: 'Avg rating',
        value: avgRatingLabel,
        trend: ratingTrend,
        trendLabel: trendLabel(ratingTrend),
        sparkline: buildSparkline(Math.round((avg ?? 90) - 80), ratingTrend),
      },
    ],
  };
}

export function buildFutureCastTargets(
  movement: StaffDashboardResponse | null,
  board: RecruitingBoardResponse | null
): HomeFutureCastTargetView[] {
  const fromMovement = (movement?.fitLeaders ?? []).slice(0, 6).map((p, idx) => {
    const ufPctNum = Math.min(100, Math.max(0, Math.round((p.ufFitScore ?? 0) * 100)));
    const delta = p.delta7d ?? p.delta ?? 0;
    return {
      id: p.id || p.slug || String(idx),
      name: p.name,
      position: '—',
      ufPercent: `${ufPctNum}%`,
      ufPctNum,
      tag: futureCastTag(ufPctNum),
      movement: trendFromDelta(delta),
    };
  });

  if (fromMovement.length >= 3) return fromMovement.slice(0, 6);

  const fromBoard = boardPlayers(board)
    .filter((p) => parseUfPct(p) > 0)
    .sort((a, b) => parseUfPct(b) - parseUfPct(a))
    .slice(0, 6)
    .map((p) => {
      const ufPctNum = parseUfPct(p);
      const dir = p.movementDirection ?? 'flat';
      return {
        id: p.slug || p.name,
        name: p.name,
        position: p.position ?? p.pos ?? '—',
        ufPercent: `${ufPctNum}%`,
        ufPctNum,
        tag: futureCastTag(ufPctNum),
        movement: dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'stable',
      } satisfies HomeFutureCastTargetView;
    });

  return fromBoard.length ? fromBoard : fromMovement;
}

function ufPctFromPrediction(p: FeedPrediction): number {
  if (p.ufProbability != null) {
    const raw = p.ufProbability;
    return Math.min(100, Math.max(0, Math.round(raw <= 1 ? raw * 100 : raw)));
  }
  if (p.confidence != null) {
    const raw = p.confidence;
    return Math.min(100, Math.max(0, Math.round(raw <= 1 ? raw * 100 : raw)));
  }
  if (p.ufFitScore != null) {
    return Math.min(100, Math.max(0, Math.round(p.ufFitScore * 100)));
  }
  return 0;
}

function mapPredictionToTarget(p: FeedPrediction, idx: number): HomeFutureCastTargetView {
  const ufPctNum = ufPctFromPrediction(p);
  const delta = p.delta ?? 0;
  return {
    id: p.playerSlug || p.playerId || p.id || String(idx),
    name: p.fullName,
    position: p.position || '—',
    ufPercent: `${ufPctNum}%`,
    ufPctNum,
    tag: futureCastTag(ufPctNum),
    movement: trendFromDelta(delta),
  };
}

function buildFutureCastTargetsFromBoard(
  board: RecruitingBoardResponse | null
): HomeFutureCastTargetView[] {
  return boardPlayers(board)
    .filter((p) => parseUfPct(p) > 0)
    .sort((a, b) => parseUfPct(b) - parseUfPct(a))
    .slice(0, 6)
    .map((p) => {
      const ufPctNum = parseUfPct(p);
      const dir = p.movementDirection ?? 'flat';
      return {
        id: p.slug || p.name,
        name: p.name,
        position: p.position ?? p.pos ?? '—',
        ufPercent: `${ufPctNum}%`,
        ufPctNum,
        tag: futureCastTag(ufPctNum),
        movement: dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'stable',
      } satisfies HomeFutureCastTargetView;
    });
}

function buildFutureCastTargetsFromMovementIntel(
  movement: MovementIntelResponse | null
): HomeFutureCastTargetView[] {
  return (movement?.risers ?? []).slice(0, 6).map((player, idx) => {
    const ufPctNum = Math.min(
      100,
      Math.max(0, Math.round(player.ufProb <= 1 ? player.ufProb * 100 : player.ufProb))
    );
    const delta = movementDelta7d(player);
    return {
      id: player.slug || player.id || String(idx),
      name: player.name,
      position: player.position || '—',
      ufPercent: `${ufPctNum}%`,
      ufPctNum,
      tag: futureCastTag(ufPctNum),
      movement: trendFromDelta(delta),
    };
  });
}

/** Prefer Postgres FutureCast home API; fall back to movement intel risers + board. */
export function buildFutureCastTargetsFromHome(
  home: FutureCastHomeResponse | null,
  movement: MovementIntelResponse | null,
  board: RecruitingBoardResponse | null
): HomeFutureCastTargetView[] {
  const candidates = [
    ...(home?.topTargets ?? []),
    ...(home?.trendingUp ?? []),
    ...(home?.trendingDown ?? []),
  ];
  const seen = new Set<string>();
  const fromHome: HomeFutureCastTargetView[] = [];
  for (const row of candidates) {
    const id = row.playerSlug || row.playerId || row.id;
    if (!id || seen.has(id)) continue;
    const mapped = mapPredictionToTarget(row, fromHome.length);
    if (mapped.ufPctNum <= 0) continue;
    seen.add(id);
    fromHome.push(mapped);
    if (fromHome.length >= 6) break;
  }
  if (fromHome.length >= 1) return fromHome;

  const fromMovement = buildFutureCastTargetsFromMovementIntel(movement);
  if (fromMovement.length >= 1) return fromMovement;

  return buildFutureCastTargetsFromBoard(board);
}

export function buildBeatPostsFromIntel(items: BeatIntelItem[]): HomeBeatPostView[] {
  return items.slice(0, 3).map((item) => ({
    id: item.id,
    writerName: item.writerName || 'Beat Writer',
    outlet: item.source || 'UF Beat',
    text: item.text,
    timestamp: item.timestamp || '',
    xUrl: item.url ?? '#',
    badge: 'Beat Writer',
  }));
}

export function buildBeatPosts(items: LivePanelProps['items']): HomeBeatPostView[] {
  return items.slice(0, 3).map((item, idx) => ({
    id: String(idx),
    writerName: item.writerName ?? item.handle ?? item.source ?? 'Beat Writer',
    outlet: item.source ?? 'UF Beat',
    text: item.text,
    timestamp: item.timestamp ?? '',
    xUrl: item.url ?? '#',
    badge: 'Beat Writer',
  }));
}

export function computeKickoffProgress(kickoffIso: string): {
  countdown: string;
  progressPct: number;
  daysLeft: number;
} {
  const kickoff = new Date(kickoffIso).getTime();
  const now = Date.now();
  const diff = kickoff - now;
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff / (1000 * 60 * 60)) % 24));
  const minutes = Math.max(0, Math.floor((diff / (1000 * 60)) % 60));
  const seconds = Math.max(0, Math.floor((diff / 1000) % 60));

  const countdown =
    diff <= 0
      ? 'Kickoff — Go Gators!'
      : `${days} days · ${hours} hours · ${minutes} minutes · ${seconds}s`;

  const startWindow = kickoff - 1000 * 60 * 60 * 24 * 90;
  const totalSpan = kickoff - startWindow;
  const clamped = Math.min(Math.max(now - startWindow, 0), totalSpan);
  const progressPct = totalSpan > 0 ? (clamped / totalSpan) * 100 : 100;

  return { countdown, progressPct, daysLeft: days };
}

export function gameDayBadge(daysLeft: number, isRival: boolean): string | null {
  if (isRival && daysLeft <= 14) return 'RIVALRY WEEK';
  if (daysLeft <= 7) return 'GAME WEEK';
  return null;
}

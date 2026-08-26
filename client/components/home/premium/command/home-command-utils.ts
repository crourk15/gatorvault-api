import type { RecruitingSnapshot } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import type { RecruitingBoardResponse, RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { FutureCastHomeResponse } from '@/lib/futurecast-home-api';
import type { FeedPrediction } from '@/lib/predictions-api';
import type { LivePanelProps } from '@/lib/gatornation-live-types';
import type { BeatIntelItem, HighPriorityIntelItem } from '@/lib/recruiting-ui-api';
import type { FlipWatchRow, MovementNarrativeRow, VisitRecapRow } from '@/lib/futurecast-high-priority-api';
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
  gameId: string;
  opponent: string;
  opponentShort: string;
  dateLabel: string;
  venue: string;
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
    gameId: NEXT_GAME.id,
    opponent: NEXT_GAME.opp,
    opponentShort: opponentInitials(NEXT_GAME.opp),
    dateLabel: NEXT_GAME.date,
    venue: NEXT_GAME.venue,
    kickoffIso: NEXT_GAME_KICKOFF_ISO,
    isRival: RIVAL_OPPONENT_IDS.has(NEXT_GAME.id),
  };
}

export type HomeTrustTickerInput = {
  hubTicker: string[];
  hpIntel: HighPriorityIntelItem[];
  movement: MovementIntelResponse | null;
  flipWatch?: FlipWatchRow[];
  visitRecap?: VisitRecapRow[];
  movementNarratives?: MovementNarrativeRow[];
};

const HOME_TICKER_FALLBACKS = [
  'Live recruiting pulse warming — check back in a moment',
  'FutureCast leans UF for multiple blue-chip targets',
  'Staff locked in for summer evals and camps',
  'GatorNation Live — real-time pulse from the Swamp',
] as const;

function isGenericClassPulse(text: string): boolean {
  return /class trending nationally/i.test(text) || /^Blue chip % at\b/i.test(text);
}

function isWeakAnonPulse(text: string): boolean {
  // Movement rows without a player name — not worth a NOW slot alone.
  return /^(uv|unofficial visit|official visit|offer)\b/i.test(text);
}

function isThinClassMetricPulse(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  if (/^Blue chip % at 100%/i.test(t)) return true;
  if (/^1\s+(commit|signee)s?\s+locked\b/i.test(t)) return true;
  return false;
}

function isRivalOnlyOfferPulse(text: string): boolean {
  const t = String(text || '').trim();
  return /\bOffer from\b/i.test(t) && !/\bOffer from Florida\b/i.test(t);
}

/** Higher = more elite for Gator Nation NOW. */
export function eliteHomeNowScore(text: string): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  if (isThinClassMetricPulse(t)) return 5;
  if (/\bVerified OV\b/i.test(t)) return 104;
  if (/\bFlip Watch\b/i.test(t)) return 102;
  if (/\b(unofficial|official)\s+visit\s*[·•]\s*Florida\b/i.test(t)) return 100;
  if (/\bFlorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(t)) return 98;
  if (/\brising\s*—\s*UF\b/i.test(t)) return 90;
  if (/\b(unofficial|official)\s+visit\s*[·•]/i.test(t)) return 72;
  if (/\bFlorida offer\b/i.test(t) || /\bOffer from Florida\b/i.test(t)) return 58;
  if (/class trending nationally/i.test(t) && /#\d+/i.test(t)) return 70;
  if (/^\d+\s+(commits|signees)\s+locked\b/i.test(t)) {
    const n = Number((t.match(/^(\d+)/) || [])[1] || 0);
    if (n >= 10) return 68;
    if (n >= 5) return 50;
    return 12;
  }
  if (/^Blue chip % at\b/i.test(t)) return 35;
  if (/\bVisit scheduled\b/i.test(t)) return 48;
  if (isRivalOnlyOfferPulse(t)) return 22;
  return 40;
}

export function rankEliteHomeNowStories(lines: string[], limit = 6): string[] {
  const incoming = (Array.isArray(lines) ? lines : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const scored: Array<{ line: string; score: number }> = [];
  let floridaOfferCount = 0;

  for (const line of incoming) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let score = eliteHomeNowScore(line);
    if (score <= 5) continue;
    const bareFl =
      /\bFlorida offer\b/i.test(line) || /\bOffer from Florida\b/i.test(line);
    if (bareFl) {
      floridaOfferCount += 1;
      if (floridaOfferCount > 2) continue;
    }
    scored.push({ line, score });
  }

  scored.sort((a, b) => b.score - a.score || a.line.localeCompare(b.line));
  return scored.slice(0, limit).map((row) => row.line);
}

/** Merge closing-class + chase tickers into one elite NOW strip. */
export function mergeEliteHomeTickers(
  primary: string[] | null | undefined,
  chase: string[] | null | undefined,
  limit = 8
): string[] {
  return rankEliteHomeNowStories(
    [...(Array.isArray(primary) ? primary : []), ...(Array.isArray(chase) ? chase : [])],
    limit
  );
}

/** Beat Desk / allowlist-intel ops — never Gator Nation Home NOW. */
function isDeskOpsPulseCopy(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return true;
  return (
    /continuous allowlist intel sweep|from player card|allowlist board pulse|beat brief|beat desk|copy brief|open brief|staff note\s*—|auto:allowlist|\bon file\b/i.test(
      t
    ) || /^(staff note|visit update|beat intel|commit check-?ins)\b/i.test(t)
  );
}

function fanFacingPulseLine(text?: string | null): string | null {
  const src = String(text || '').trim();
  if (!src) return null;
  let raw = src
    .replace(/\s*Continuous allowlist intel sweep\.?/gi, '')
    .replace(/\s*from player card\.?/gi, '')
    .replace(/\s*\(allowlist board pulse\)\.?/gi, '')
    .replace(/\s+on file(?:\s*\([^)]*\))?\.?/gi, '')
    .replace(/^staff note\s*—\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s·•\-—–|]+/, '')
    .trim();
  if (!raw || isDeskOpsPulseCopy(raw)) {
    const m = src.match(/^(.+?)\s*[—-]\s*.*\bflorida\s+offer\b/i);
    if (m) return `${m[1].trim()} — Florida offer`;
    if (/\bflorida\s+offer\b/i.test(src)) return 'Florida offer';
    if (/\bflorida\s+(?:unofficial\s+|official\s+)?visit\b/i.test(src)) return 'Florida visit';
    return null;
  }
  return raw;
}

/** Hardcoded "N commits locked for YEAR" — never leave these baked in the binary. */
const COMMIT_COUNT_LINE_RE = /^\d+\s+(commits|signees)\s+locked\s+for\s+(\d{4})\b/i;

export function isCommitCountPulseLine(text: string): boolean {
  return COMMIT_COUNT_LINE_RE.test(String(text || '').trim());
}

/**
 * Commit / decommit counts must track live hub metrics — not Capacitor seed stone.
 * - With a live count: rewrite / insert the locked-for line.
 * - Without + allowExistingCount: keep live ticker counts (API already correct).
 * - Without + seed path: strip baked count lines so NOW never flashes a stale number.
 */
export function applyLiveCommitCountToTicker(
  ticker: string[] | null | undefined,
  opts: {
    year: number;
    commits?: string | number | null;
    commitLabel?: string | null;
    /** Keep existing "N commits locked" lines when no live metrics yet (live ticker). */
    allowExistingCount?: boolean;
  }
): string[] {
  const year = Number(opts.year);
  const incoming = (Array.isArray(ticker) ? ticker : [])
    .map((t) => String(t || '').trim())
    .filter(Boolean);

  const raw = opts.commits;
  const n =
    raw == null || raw === '' || raw === '—'
      ? NaN
      : Number(String(raw).replace(/[^\d.]/g, ''));

  if (Number.isFinite(n) && n > 0 && Number.isFinite(year) && year >= 2000) {
    const base = incoming.filter((t) => !isCommitCountPulseLine(t));
    const labelRaw = String(
      opts.commitLabel || (year <= new Date().getFullYear() ? 'Signees' : 'Commits')
    );
    const label = labelRaw.toLowerCase();
    const nRound = Math.round(n);
    const unit = nRound === 1 ? label.replace(/s$/i, '') : label;
    const line = `${nRound} ${unit} locked for ${year}`;
    let insertAt = 0;
    for (let i = 0; i < base.length; i += 1) {
      if (isGenericClassPulse(base[i])) insertAt = i + 1;
    }
    const out = base.slice();
    out.splice(insertAt, 0, line);
    return out;
  }

  if (opts.allowExistingCount) return incoming;
  return incoming.filter((t) => !isCommitCountPulseLine(t));
}

/** Ranked NOW stories from live hub/intel — rotates on the home strip. */
export function buildHomePulseStories(input: HomeTrustTickerInput, limit = 6): string[] {
  const pool: string[] = [];

  const push = (value?: string | null) => {
    const text = fanFacingPulseLine(value);
    if (!text) return;
    if (isThinClassMetricPulse(text)) return;
    pool.push(text);
  };

  for (const row of input.visitRecap ?? []) {
    if (row.movementNarrative) {
      push(`${row.name} — ${row.movementNarrative}`);
      continue;
    }
    const range =
      row.visitEnd && row.visitEnd !== row.visitStart
        ? `${row.visitStart}–${row.visitEnd}`
        : row.visitStart;
    if (range) push(`Verified OV: ${row.name} (${range})`);
  }
  for (const row of input.flipWatch ?? []) {
    if (row.movementNarrative) push(`${row.name} — ${row.movementNarrative}`);
    else if (row.flipScore != null) {
      push(
        `Flip Watch: ${row.name} (${row.committedShort || 'elsewhere'}) · Flip ${row.flipScore}`
      );
    }
  }
  for (const row of input.movementNarratives ?? []) {
    if (row.movementNarrative) push(`${row.name} — ${row.movementNarrative}`);
  }
  for (const alert of input.movement?.alerts ?? []) {
    const detailRaw = String(alert.detail || '').trim();
    if (!detailRaw) continue;
    const detail = fanFacingPulseLine(detailRaw);
    if (!detail) continue;
    const player = String(alert.player || '').trim();
    if (player && detail.toLowerCase().startsWith(player.toLowerCase())) {
      push(detail);
    } else if (player) {
      push(`${player} — ${detail}`);
    } else {
      push(detail);
    }
  }
  for (const player of input.movement?.risers ?? []) {
    const ufPct = Math.round(player.ufProb <= 1 ? player.ufProb * 100 : player.ufProb);
    push(`${player.name} rising — UF at ${ufPct}%`);
  }

  for (const item of input.hubTicker) {
    const text = item.trim();
    if (!text) continue;
    if (isWeakAnonPulse(text)) continue;
    push(text);
  }
  for (const item of input.hpIntel) {
    const text = item.text?.trim();
    if (!text) continue;
    push(text);
  }

  const ranked = rankEliteHomeNowStories(pool, limit);
  if (ranked.length > 0) return ranked;
  return [...HOME_TICKER_FALLBACKS].slice(0, limit);
}

/** Prefer one concrete story for the hero — not a marquee of the whole board. */
export function buildHomePulseHeadline(input: HomeTrustTickerInput): string {
  return buildHomePulseStories(input, 1)[0] || HOME_TICKER_FALLBACKS[0];
}

/** @deprecated Prefer buildHomePulseStories — kept for any leftover callers. */
export function buildHeroTickerFromTrust(input: HomeTrustTickerInput): string[] {
  const stories = buildHomePulseStories(input, 6);
  if (
    stories.length === 1 &&
    stories[0] === HOME_TICKER_FALLBACKS[0] &&
    !(input.hubTicker?.length || input.hpIntel?.length)
  ) {
    return [...HOME_TICKER_FALLBACKS];
  }
  return stories;
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
  hoursLeft: number;
  minutesLeft: number;
  secondsLeft: number;
  isLive: boolean;
} {
  const kickoff = new Date(kickoffIso).getTime();
  const now = Date.now();
  const diff = kickoff - now;
  const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((diff / (1000 * 60 * 60)) % 24));
  const minutes = Math.max(0, Math.floor((diff / (1000 * 60)) % 60));
  const seconds = Math.max(0, Math.floor((diff / 1000) % 60));
  const isLive = diff <= 0;

  const countdown = isLive
    ? 'Kickoff — Go Gators!'
    : `${days} days · ${hours} hours · ${minutes} minutes · ${seconds}s`;

  const startWindow = kickoff - 1000 * 60 * 60 * 24 * 90;
  const totalSpan = kickoff - startWindow;
  const clamped = Math.min(Math.max(now - startWindow, 0), totalSpan);
  const progressPct = totalSpan > 0 ? (clamped / totalSpan) * 100 : 100;

  return {
    countdown,
    progressPct,
    daysLeft: days,
    hoursLeft: hours,
    minutesLeft: minutes,
    secondsLeft: seconds,
    isLive,
  };
}

export function gameDayBadge(daysLeft: number, isRival: boolean): string | null {
  if (isRival && daysLeft <= 14) return 'RIVALRY WEEK';
  if (daysLeft <= 7) return 'GAME WEEK';
  return null;
}

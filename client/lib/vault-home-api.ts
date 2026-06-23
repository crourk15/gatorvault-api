/**
 * Vault home page data layer — cached fetches for /vault homepage.
 */
import { fetchStaffDashboard, type StaffDashboardResponse } from './staff-api';
import {
  fetchMovementHeatmap,
  fetchMovementSnapshots,
  fetchStockBoard,
} from './predictions-api';
import { fetchRecruitingBoard } from './recruiting-board-api';
import { fetchFutureCastHome, fetchFutureCastClass } from './futurecast-home-api';
import { fetchNilDashboard, type NilDashboard } from './nil-api';
import { SCHEDULE_GAMES, type ScheduleGame } from './schedule-data';
import { fetchPortalWatchlist } from './portal-api';
import { fetchPortalIncoming } from './recruiting-api';
import { fetchTeamHubBundle } from './team-hub-api';
import { fetchRosterPlayers } from './roster-api';
import type { DepthChartPosition } from './team-hub-types';
import { loadAlertPrefs, loadLocalRecentAlerts } from './alert-prefs';
import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';

export const HOME_REFRESH = {
  hero: 5 * 60_000,
  ticker: 30_000,
  movement: 5 * 60_000,
  recruiting: 2 * 60_000,
  content: 2 * 60_000,
} as const;

export type TickerItem = {
  id: string;
  text: string;
  category: string;
  url: string;
  source: string;
};

export type HotCarouselItem = {
  id: string;
  title: string;
  category: string;
  url: string;
};

export type TickerResponse = {
  ok?: boolean;
  items: TickerItem[];
  storyline: string;
  hotToday: HotCarouselItem[];
  updatedAt?: string;
};

export type ContentLatestItem = {
  id: string;
  title: string;
  timestamp?: string | null;
  icon?: string;
  source?: string;
  href: string;
  replyCount?: number;
};

export type ContentLatestResponse = {
  ok?: boolean;
  articles: ContentLatestItem[];
  podcasts: ContentLatestItem[];
  filmRoom: ContentLatestItem[];
  community: ContentLatestItem[];
  updatedAt?: string;
};

export type PersonalizedAlert = {
  id: string;
  title: string;
  category?: string;
  url?: string;
  isNew?: boolean;
};

export type PersonalizedResponse = {
  ok?: boolean;
  alerts: PersonalizedAlert[];
  savedPlayers: { name: string; slug?: string | null }[];
  watchlist: { label: string; href?: string; count?: number }[];
  favoriteThreads: { id: string; title: string; href: string }[];
  updatedAt?: string;
};

export type RecruitingSnapshot = {
  commits: number;
  targets: number;
  portalActive: number;
  classRank: number | null;
  nilSecRank: number | null;
  winProbability: number;
  nextGameLabel: string;
  nextGameDays: number;
};

export type HomeBundle = {
  ticker: TickerResponse | null;
  movement: StaffDashboardResponse | null;
  content: ContentLatestResponse | null;
  recruiting: RecruitingSnapshot | null;
  momentumPct: number;
  personalized: PersonalizedResponse | null;
  portal: HomePortalSummary | null;
  team: HomeTeamSnapshotData | null;
  nil: HomeNilPulse | null;
  schedule: HomeUpcomingGamesData | null;
};

export type HomePortalPlayer = {
  id: string;
  name: string;
  position: string;
  status: 'IN' | 'OUT' | 'TARGET' | 'WARM' | 'COOL';
};

export type HomePortalSummary = {
  inboundCount: number;
  outboundCount: number;
  targetCount: number;
  topPlayers: HomePortalPlayer[];
};

export type HomeDepthItem = {
  position: string;
  player: string;
  status: 'SET' | 'OPEN';
};

export type HomeBattleItem = {
  label: string;
  players: string;
};

export type HomeInjuryItem = {
  name: string;
  status: 'OUT' | 'QUESTIONABLE' | 'PROBABLE';
};

export type HomeTeamSnapshotData = {
  depthPreview: HomeDepthItem[];
  battles: HomeBattleItem[];
  injuries: HomeInjuryItem[];
  snapSummary: string;
};

export type HomeNilPulse = {
  secRank: number;
  estPool: string;
  movementLabel: string;
  movementDelta: string;
  topEarner: string;
  topEarnerNote: string;
};

export type HomeGnlItem = {
  id: string;
  author: string;
  text: string;
  href?: string;
};

export type HomeGameCard = {
  id: string;
  opponent: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  probability: number;
};

export type HomeUpcomingGamesData = {
  games: HomeGameCard[];
};

export type HomeMovementPlayer = {
  id: string;
  slug: string;
  name: string;
  delta: number;
  ufPct?: number | null;
};

export type HomeMovementAlert = {
  id: string;
  playerId: string;
  playerName: string | null;
  eventType: string;
  text: string;
  timestamp: string;
  movementDelta?: number | null;
};

export type HomeMovementIntelData = import('./movement-intel-types').MovementIntelResponse;

type CacheSlot<T> = { at: number; data: T | null };

const memoryCache: {
  ticker: CacheSlot<TickerResponse>;
  content: CacheSlot<ContentLatestResponse>;
  movement: CacheSlot<StaffDashboardResponse>;
  recruiting: CacheSlot<RecruitingSnapshot>;
  portal: CacheSlot<HomePortalSummary>;
  team: CacheSlot<HomeTeamSnapshotData>;
  nil: CacheSlot<HomeNilPulse>;
  schedule: CacheSlot<HomeUpcomingGamesData>;
  movementIntel: CacheSlot<HomeMovementIntelData>;
} = {
  ticker: { at: 0, data: null },
  content: { at: 0, data: null },
  movement: { at: 0, data: null },
  recruiting: { at: 0, data: null },
  portal: { at: 0, data: null },
  team: { at: 0, data: null },
  nil: { at: 0, data: null },
  schedule: { at: 0, data: null },
  movementIntel: { at: 0, data: null },
};

function readCache<T>(slot: CacheSlot<T>, ttlMs: number): T | null {
  if (!slot.data || Date.now() - slot.at > ttlMs) return null;
  return slot.data;
}

function writeCache<T>(slot: CacheSlot<T>, data: T): T {
  slot.data = data;
  slot.at = Date.now();
  return data;
}

async function fetchJson<T>(path: string): Promise<T> {
  return snapshotFirstFetch(path, () => snapshotLiveFetch<T>(path));
}

export async function fetchLiveTicker(force = false): Promise<TickerResponse> {
  if (!force) {
    const cached = readCache(memoryCache.ticker, HOME_REFRESH.ticker);
    if (cached) return cached;
  }
  const data = await fetchJson<TickerResponse>('/api/live/ticker');
  return writeCache(memoryCache.ticker, data);
}

export async function fetchContentLatest(force = false): Promise<ContentLatestResponse> {
  if (!force) {
    const cached = readCache(memoryCache.content, HOME_REFRESH.content);
    if (cached) return cached;
  }
  const data = await fetchJson<ContentLatestResponse>('/api/content/latest');
  return writeCache(memoryCache.content, data);
}

export async function fetchMovementPreview(force = false): Promise<StaffDashboardResponse> {
  if (!force) {
    const cached = readCache(memoryCache.movement, HOME_REFRESH.movement);
    if (cached) return cached;
  }

  const [staff, heatmap, stock, snapshots] = await Promise.all([
    fetchStaffDashboard().catch(() => null),
    fetchMovementHeatmap().catch(() => null),
    fetchStockBoard().catch(() => null),
    fetchMovementSnapshots().catch(() => null),
  ]);

  let data = staff;
  if (!data) {
    data = {
      topRisers: [],
      topFallers: [],
      highVolatility: [],
      lowVolatility: [],
      fitLeaders: [],
      fitRisks: [],
      heatmap: { buckets: heatmap?.buckets ?? [], windowDays: heatmap?.windowDays ?? 7 },
      alerts: [],
      movementWindowDays: stock?.windowDays ?? 7,
      volatilityWindowDays: snapshots?.weeklyWindowDays ?? 7,
    };
  } else if (heatmap?.buckets?.length && !data.heatmap?.buckets?.length) {
    data = {
      ...data,
      heatmap: { buckets: heatmap.buckets, windowDays: heatmap.windowDays ?? data.heatmap.windowDays },
    };
  }

  if (data.topRisers.length === 0 && stock?.stockUp?.length) {
    data = {
      ...data,
      topRisers: stock.stockUp.slice(0, 10).map((row) => ({
        id: row.playerId,
        slug: row.playerSlug,
        name: row.fullName,
        delta: row.delta,
      })),
    };
  }

  if (data.topFallers.length === 0 && stock?.stockDown?.length) {
    data = {
      ...data,
      topFallers: stock.stockDown.slice(0, 10).map((row) => ({
        id: row.playerId,
        slug: row.playerSlug,
        name: row.fullName,
        delta: row.delta,
      })),
    };
  }

  return writeCache(memoryCache.movement, data);
}

export async function fetchHomeMovementIntel(force = false): Promise<HomeMovementIntelData> {
  if (!force) {
    const cached = readCache(memoryCache.movementIntel, HOME_REFRESH.movement);
    if (cached) return cached;
  }
  const data = await fetchJson<HomeMovementIntelData>('/api/recruiting/movement-intel');
  return writeCache(memoryCache.movementIntel, data);
}

const NEXT_GAME_ISO = '2026-09-05T19:45:00-04:00';

export function daysUntilNextGame(): number {
  const ms = new Date(NEXT_GAME_ISO).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function computeMomentumPct(
  heatmap: StaffDashboardResponse['heatmap'] | null | undefined,
  classScore: number | null | undefined
): number {
  const buckets = heatmap?.buckets ?? [];
  const up = buckets.find((b) => b.label === 'Up')?.count ?? 0;
  const down = buckets.find((b) => b.label === 'Down')?.count ?? 0;
  const flat = buckets.find((b) => b.label === 'Flat')?.count ?? 0;
  const total = up + down + flat;
  if (total > 0) {
    const ratio = up / total;
    return Math.round(40 + ratio * 55);
  }
  if (classScore != null) return Math.min(99, Math.max(35, Math.round(classScore)));
  return 72;
}

export function buildWhyItMatters(movement: StaffDashboardResponse | null): string {
  const risers = movement?.topRisers?.length ?? 0;
  const fallers = movement?.topFallers?.length ?? 0;
  if (risers >= 3) {
    return `UF gained traction with ${Math.min(risers, 3)} priority targets this week.`;
  }
  if (fallers >= 3) {
    return `Several targets cooling — staff may need a push before key visits.`;
  }
  if (movement?.alerts?.length) {
    const first = movement.alerts[0];
    return first?.message || 'Movement intel is active this week.';
  }
  return 'Track risers and fallers to spot momentum shifts before they hit the feed.';
}

export async function fetchRecruitingSnapshot(force = false): Promise<RecruitingSnapshot> {
  if (!force) {
    const cached = readCache(memoryCache.recruiting, HOME_REFRESH.recruiting);
    if (cached) return cached;
  }

  const [board, fc, fcClass, nil] = await Promise.all([
    fetchRecruitingBoard(2027).catch(() => null),
    fetchFutureCastHome().catch(() => null),
    fetchFutureCastClass().catch(() => null),
    fetchNilDashboard().catch(() => null),
  ]);

  const nextGame = SCHEDULE_GAMES[0];
  const snapshot: RecruitingSnapshot = {
    commits: board?.commits?.length ?? fc?.commits?.length ?? fc?.commitTotal ?? 0,
    targets: board?.targets?.length ?? fc?.topTargets?.length ?? 0,
    portalActive: fc?.portalWatchlist?.length ?? 0,
    classRank:
      fcClass?.rankings?.nationalRank ??
      board?.rankings?.nationalRank ??
      null,
    nilSecRank: nil?.ufStanding?.secRank ?? null,
    winProbability: nextGame?.ufPct ?? 94,
    nextGameLabel: nextGame ? `FLORIDA vs ${nextGame.opp.split(' ')[0]?.toUpperCase() ?? 'FAU'}` : 'FLORIDA vs FAU',
    nextGameDays: daysUntilNextGame(),
  };

  return writeCache(memoryCache.recruiting, snapshot);
}

function mapPortalStatus(
  direction: 'in' | 'out' | 'target',
  likelihood?: number
): HomePortalPlayer['status'] {
  if (direction === 'in') return 'IN';
  if (direction === 'out') return 'OUT';
  if (likelihood != null && likelihood >= 0.7) return 'WARM';
  if (likelihood != null && likelihood <= 0.35) return 'COOL';
  return 'TARGET';
}

function mapDepthStatus(status: DepthChartPosition['status']): HomeDepthItem['status'] {
  return status === 'Locked' ? 'SET' : 'OPEN';
}

function mapInjuryStatusElite(injury: string): HomeInjuryItem['status'] {
  const value = injury.toLowerCase();
  if (value === 'red' || value === 'out') return 'OUT';
  if (value === 'yellow' || value === 'questionable') return 'QUESTIONABLE';
  return 'PROBABLE';
}

function pickKeyDepthRows(positions: DepthChartPosition[]): HomeDepthItem[] {
  const labels = ['QB', 'WR (Z)', 'JACK', 'CB'];
  const picked: HomeDepthItem[] = [];
  for (const label of labels) {
    const row = positions.find((p) => p.label === label || p.label.startsWith(label.split(' ')[0]));
    if (row) {
      picked.push({
        position: row.label,
        player: depthStarter(row),
        status: mapDepthStatus(row.status),
      });
    }
  }
  if (picked.length >= 3) return picked.slice(0, 3);
  return positions.slice(0, 3).map((row) => ({
    position: row.label,
    player: depthStarter(row),
    status: mapDepthStatus(row.status),
  }));
}

function formatNilPool(value: number | null | undefined): string {
  if (value == null) return '—';
  return `$${value.toFixed(1)}M`;
}

function formatNilMovement(pct: number | null | undefined, label: string | null | undefined): {
  movementLabel: string;
  movementDelta: string;
} {
  if (pct == null) {
    return { movementLabel: label ?? 'Stable', movementDelta: '—' };
  }
  const sign = pct >= 0 ? '↑' : '↓';
  return {
    movementLabel: `${sign} YoY`,
    movementDelta: `${pct >= 0 ? '+' : ''}${pct}%`,
  };
}

function parseScheduleCard(game: ScheduleGame): HomeGameCard {
  const parts = game.date.split(' · ');
  return {
    id: game.id,
    opponent: game.opp,
    dateLabel: parts[0] ?? game.date,
    timeLabel: parts[1] ?? '',
    venue: game.venue,
    probability: game.ufPct,
  };
}

export function buildHomeGnlItems(ticker: TickerResponse | null): HomeGnlItem[] {
  const fromTicker = (ticker?.items ?? []).slice(0, 5).map((item) => ({
    id: item.id,
    author: item.source || 'GatorVault',
    text: item.text,
    href: item.url,
  }));
  if (fromTicker.length > 0) return fromTicker;

  const fromHot = (ticker?.hotToday ?? []).slice(0, 5).map((item) => ({
    id: item.id,
    author: 'Trending',
    text: item.title,
    href: item.url,
  }));
  if (fromHot.length > 0) return fromHot;

  if (ticker?.storyline) {
    return [{ id: 'storyline', author: 'GatorVault', text: ticker.storyline }];
  }

  return [];
}

function depthStarter(row: DepthChartPosition): string {
  return row.players[0]?.name?.split('/')[0]?.trim() || 'TBD';
}

function flattenBattles(positions: DepthChartPosition[]): HomeBattleItem[] {
  return positions
    .filter((row) => row.status === 'Battle')
    .slice(0, 3)
    .map((row) => ({
      label: row.label,
      players: row.players
        .slice(0, 2)
        .map((p) => p.name)
        .join(' / '),
    }));
}

export async function fetchHomePortalSummary(force = false): Promise<HomePortalSummary> {
  if (!force) {
    const cached = readCache(memoryCache.portal, HOME_REFRESH.recruiting);
    if (cached) return cached;
  }

  const [watchlist, incoming] = await Promise.all([
    fetchPortalWatchlist({ limit: 12, sort: 'likelihood' }).catch(() => ({ players: [] })),
    fetchPortalIncoming(12).catch(() => []),
  ]);

  const topPlayers: HomePortalPlayer[] = [];
  let inboundCount = 0;
  let outboundCount = 0;
  let targetCount = 0;

  for (const player of incoming) {
    inboundCount += 1;
    if (topPlayers.length < 3) {
      topPlayers.push({
        id: `in-${player.id}`,
        name: player.fullName,
        position: player.position,
        status: 'IN',
      });
    }
  }

  for (const player of watchlist.players) {
    const likelihood =
      player.portalLikelihood <= 1 ? player.portalLikelihood : player.portalLikelihood / 100;
    const direction = likelihood >= 0.55 ? 'out' : 'target';
    if (direction === 'out') outboundCount += 1;
    else targetCount += 1;

    if (topPlayers.length < 3) {
      topPlayers.push({
        id: `wl-${player.id}`,
        name: player.fullName,
        position: player.position,
        status: mapPortalStatus(direction, likelihood),
      });
    }
  }

  return writeCache(memoryCache.portal, {
    inboundCount,
    outboundCount,
    targetCount,
    topPlayers: topPlayers.slice(0, 3),
  });
}

export async function fetchHomeTeamSnapshot(force = false): Promise<HomeTeamSnapshotData> {
  if (!force) {
    const cached = readCache(memoryCache.team, HOME_REFRESH.recruiting);
    if (cached) return cached;
  }

  const [bundle, roster] = await Promise.all([
    fetchTeamHubBundle().catch(() => null),
    fetchRosterPlayers().catch(() => []),
  ]);

  const offense = bundle?.depthChart.offense ?? [];
  const defense = bundle?.depthChart.defense ?? [];
  const allPositions = [...offense, ...defense];
  const lockedCount = bundle?.commandStats.startersLocked ?? allPositions.filter((row) => row.status === 'Locked').length;
  const battleCount = bundle?.commandStats.positionBattles ?? allPositions.filter((row) => row.status === 'Battle').length;

  const injuries = roster
    .filter((p) => p.injury && p.injury.toLowerCase() !== 'green')
    .slice(0, 3)
    .map((p) => ({
      name: p.name,
      status: mapInjuryStatusElite(String(p.injury)),
    }));

  const data: HomeTeamSnapshotData = {
    depthPreview: pickKeyDepthRows([...offense, ...defense]),
    injuries,
    battles: flattenBattles(allPositions),
    snapSummary: `Starters locked at ${lockedCount}/22 — ${battleCount} open battles ahead of fall camp.`,
  };

  return writeCache(memoryCache.team, data);
}

export async function fetchHomeNilPulse(force = false): Promise<HomeNilPulse> {
  if (!force) {
    const cached = readCache(memoryCache.nil, HOME_REFRESH.recruiting);
    if (cached) return cached;
  }

  const dashboard: NilDashboard = await fetchNilDashboard().catch(() => ({}));
  const standing = dashboard.ufStanding ?? {};
  const recentEvents = dashboard.recentEvents ?? [];
  const movement = formatNilMovement(standing.trendPct, standing.trend);

  const pulse: HomeNilPulse = {
    secRank: standing.secRank ?? 0,
    estPool: formatNilPool(standing.estimatedAnnualPoolM),
    movementLabel: movement.movementLabel,
    movementDelta: movement.movementDelta,
    topEarner: standing.collective ?? dashboard.secRankings?.[0]?.collective ?? 'Gators Collective',
    topEarnerNote:
      recentEvents.length > 0
        ? `${recentEvents.length} recent NIL events`
        : 'Tracking collective activity',
  };

  return writeCache(memoryCache.nil, pulse);
}

export function buildUpcomingScheduleGames(limit = 3): ScheduleGame[] {
  const now = Date.now();
  const upcoming = SCHEDULE_GAMES.filter((game) => {
    const parsed = Date.parse(game.date.replace(/ · .+$/, ''));
    return Number.isFinite(parsed) ? parsed >= now - 86_400_000 : true;
  });
  return (upcoming.length ? upcoming : SCHEDULE_GAMES).slice(0, limit);
}

export async function fetchHomeUpcomingGames(force = false): Promise<HomeUpcomingGamesData> {
  if (!force) {
    const cached = readCache(memoryCache.schedule, HOME_REFRESH.hero);
    if (cached) return cached;
  }
  return writeCache(memoryCache.schedule, { games: buildUpcomingScheduleGames(3).map(parseScheduleCard) });
}

export async function fetchPersonalizedHints(): Promise<PersonalizedResponse> {
  const prefs = loadAlertPrefs();
  const follow = prefs.followPlayers.join(',');
  const qs = follow ? `?followPlayers=${encodeURIComponent(follow)}` : '';
  const server = await fetchJson<PersonalizedResponse>(`/api/user/personalized${qs}`).catch(
    () =>
      ({
        alerts: [],
        savedPlayers: [],
        watchlist: [],
        favoriteThreads: [],
      }) as PersonalizedResponse
  );

  const localAlerts = loadLocalRecentAlerts()
    .filter((a) => !a.read)
    .slice(0, 4)
    .map((a, idx) => ({
      id: `local_${idx}`,
      title: a.title || a.text || 'Alert',
      category: a.type,
      isNew: true,
    }));

  const savedPlayers =
    prefs.followPlayers.length > 0
      ? prefs.followPlayers.map((name) => ({ name }))
      : server.savedPlayers;

  return {
    ...server,
    alerts: localAlerts.length ? localAlerts : server.alerts,
    savedPlayers,
    watchlist:
      prefs.followPlayers.length > 0
        ? [{ label: 'Your Followed Players', count: prefs.followPlayers.length }]
        : server.watchlist,
  };
}

export function heatmapSparkPct(buckets: StaffDashboardResponse['heatmap']['buckets']): number {
  const up = buckets.find((b) => b.label === 'Up')?.count ?? 0;
  const down = buckets.find((b) => b.label === 'Down')?.count ?? 0;
  const flat = buckets.find((b) => b.label === 'Flat')?.count ?? 0;
  const total = up + down + flat;
  if (!total) return 0;
  return Math.round((up / total) * 100);
}

export type HomeBoardPreview = {
  year: number;
  classRank: number | null;
  blueChipPct: number | null;
  commitCount: number;
};

export async function fetchHomeBoardsPreview(force = false): Promise<HomeBoardPreview[]> {
  const years = [2026, 2027, 2028] as const;
  const { fetchRecruitingClass } = await import('@/api/recruiting');
  const payloads = await Promise.all(
    years.map((year) => fetchRecruitingClass(year).catch(() => null))
  );
  return years.map((year, index) => {
    const data = payloads[index];
    return {
      year,
      classRank: data?.nationalRank ?? null,
      blueChipPct:
        data?.blueChipRatio != null ? Math.round(data.blueChipRatio * 100) : null,
      commitCount: data?.commits ?? 0,
    };
  });
}

export async function fetchHomeBundle(force = false): Promise<HomeBundle> {
  const [ticker, movement, content, recruiting, personalized, portal, team, nil, schedule] =
    await Promise.all([
      fetchLiveTicker(force).catch(() => null),
      fetchMovementPreview(force).catch(() => null),
      fetchContentLatest(force).catch(() => null),
      fetchRecruitingSnapshot(force).catch(() => null),
      fetchPersonalizedHints().catch(() => null),
      fetchHomePortalSummary(force).catch(() => null),
      fetchHomeTeamSnapshot(force).catch(() => null),
      fetchHomeNilPulse(force).catch(() => null),
      fetchHomeUpcomingGames(force).catch(() => null),
    ]);

  return {
    ticker,
    movement,
    content,
    recruiting,
    momentumPct: movement ? heatmapSparkPct(movement.heatmap.buckets) : 0,
    personalized,
    portal,
    team,
    nil,
    schedule,
  };
}

export async function fetchHomeIntelPreview(force = false): Promise<
  import('@/components/recruiting-hub/HighPriorityIntel/types').HighPriorityIntelItem[]
> {
  const { mapBoardTargetToHighPriorityIntelItem } = await import(
    '@/components/recruiting-hub/utils/intelMapping'
  );
  const { fetchHighPriorityIntel } = await import('./recruiting-ui-api');
  const [intel, board] = await Promise.all([
    fetchHighPriorityIntel(),
    fetchRecruitingBoard(2027).catch(() => null),
  ]);

  if (!board?.targets?.length) {
    return intel.slice(0, 6).map((item, index) => ({
      id: item.id,
      slug: String(item.playerSlug || item.playerId || item.id),
      name: item.text.split('—')[0]?.trim() || 'UF Target',
      position: '—',
      classYear: 2027,
      ufProb: item.ufProbability,
      delta7d: 0,
      intelType: 'HEAT' as const,
      intelLabel: 'High priority',
      intelSummary: item.text,
      analystSignals: [],
      lastUpdated: item.timestamp,
    }));
  }

  const bySlug = new Map(
    (board.targets ?? []).map((player) => [player.slug, player])
  );
  return intel.slice(0, 6).map((item, index) => {
    const slug = String(item.playerSlug || item.playerId || '');
    const player = bySlug.get(slug);
    if (player) return mapBoardTargetToHighPriorityIntelItem(player, index);
    return {
      id: item.id,
      slug: slug || item.id,
      name: item.text.split('—')[0]?.trim() || 'UF Target',
      position: '—',
      classYear: 2027,
      ufProb: item.ufProbability,
      delta7d: 0,
      intelType: 'HEAT' as const,
      intelLabel: 'High priority',
      intelSummary: item.text,
      analystSignals: [],
      lastUpdated: item.timestamp,
    };
  });
}

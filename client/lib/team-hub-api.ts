import { type RosterPlayer } from './roster-api';
import { snapshotFirstFetch, snapshotLiveFetch, DEFAULT_SNAPSHOT_FETCH_OPTS } from './snapshot-fetch';
import { fetchWithWarmPoll } from './api-warm-poll';
import { warmPollProfile } from './warm-poll-profile';
import {
  FALLBACK_COACHES,
  TEAM_ACHIEVEMENTS,
  TEAM_DEPTH_CHART,
  TEAM_ERAS,
  TEAM_IDENTITY,
  coachInitials,
} from './team-hub-data';
import type { Coach, DepthChart, Era, Achievement, IdentityBlock, TeamPlayer, TeamCommandStats } from './team-hub-types';
import { computeTeamCommandStats } from '@/components/team/team-command-stats';
import { TEAM_HUB_SEED } from '@/lib/team-hub-seed';
import { cacheFirstFetch, readSwrCache } from './stale-while-revalidate';
import { fallbackDepthChartBoard, fetchDepthChartBoard, type DepthChartBoard } from './depth-chart-api';

export type TeamHubBundle = {
  eras: Era[];
  achievements: Achievement[];
  identity: IdentityBlock[];
  coaches: Coach[];
  roster: TeamPlayer[];
  depthChart: DepthChart;
  depthLabel: string;
  depthSubtitle: string;
  commandStats: TeamCommandStats;
  updatedAt: string | null;
};

const TEAM_HUB_BUNDLE_CACHE_KEY = 'gv_swr_v1:team-hub-bundle';

function teamBundleUsable(data: unknown): boolean {
  if (data == null || typeof data !== 'object') return false;
  const bundle = data as Partial<TeamHubBundle>;
  return Array.isArray(bundle.roster) && bundle.roster.length > 0;
}

/** Static first-paint seed — real roster/staff/depth without waiting on API. */
export function buildSeedTeamHubBundle(): TeamHubBundle {
  const depthBoard = fallbackDepthChartBoard();
  const depthChart = depthBoard.depthChart;
  const roster = TEAM_HUB_SEED.roster ?? [];
  const coaches =
    TEAM_HUB_SEED.coaches?.length > 0
      ? TEAM_HUB_SEED.coaches.map((c) => ({ ...c }))
      : FALLBACK_COACHES.map((c) => ({ ...c }));
  const meta = TEAM_HUB_SEED.meta;
  const commandStats = computeTeamCommandStats(roster, depthChart, meta);
  if (meta?.units) {
    commandStats.offenseCount = meta.units.offense ?? commandStats.offenseCount;
    commandStats.defenseCount = meta.units.defense ?? commandStats.defenseCount;
  }
  return {
    eras: TEAM_ERAS,
    achievements: TEAM_ACHIEVEMENTS,
    identity: TEAM_IDENTITY,
    coaches,
    roster,
    depthChart,
    depthLabel: depthBoard.label,
    depthSubtitle: depthBoard.subtitle,
    commandStats,
    updatedAt: depthBoard.updatedAt ?? meta?.updatedAt ?? TEAM_HUB_SEED.generatedAt ?? null,
  };
}

/** Sync read for React initial state — instant Team paint on revisit. */
export function readCachedTeamHubBundle(): TeamHubBundle | null {
  const cached = readSwrCache<TeamHubBundle>(TEAM_HUB_BUNDLE_CACHE_KEY, {
    isUsable: teamBundleUsable,
  });
  if (!cached) return null;
  const fallback = fallbackDepthChartBoard();
  return {
    ...cached,
    depthChart: cached.depthChart?.offense?.length ? cached.depthChart : fallback.depthChart,
    depthLabel: cached.depthLabel || fallback.label,
    depthSubtitle: cached.depthSubtitle || fallback.subtitle,
  };
}

type StaffApiCoach = {
  id: string;
  name: string;
  title: string;
  bio?: string;
  highlights?: string[];
};

type StaffApiResponse = {
  coaches?: StaffApiCoach[];
  analysts?: StaffApiCoach[];
  supportStaff?: { role: string; name: string }[];
};

function normalizeClassYear(player: RosterPlayer): string {
  const raw = String(player.year ?? player.class ?? '').trim();
  if (!raw) return '—';
  if (/^(R-)?(Fr|So|Jr|Sr)\.?$/i.test(raw)) {
    const redshirt = raw.toLowerCase().startsWith('r-');
    const abbr = raw.replace(/^r-/i, '').replace(/\.$/, '');
    const map: Record<string, string> = { fr: 'Fr.', so: 'So.', jr: 'Jr.', sr: 'Sr.' };
    const base = map[abbr.toLowerCase()] ?? abbr;
    return redshirt ? `R-${base.replace('.', '')}.` : base;
  }
  return raw;
}

function mapRosterPlayer(p: RosterPlayer): TeamPlayer {
  const pos = String(p.pos ?? p.position ?? '—').toUpperCase();
  const hometown = p.hometown?.trim();
  const stateMatch = hometown?.match(/,\s*([A-Z]{2})$/);
  const tags: string[] = [];
  if (p.depthChartTier === 'starter') tags.push('starter');
  if (p.transferInfo?.toLowerCase().includes('portal')) tags.push('portal');

  return {
    id: p.id || p.slug,
    name: p.name,
    position: pos,
    positionGroup: p.positionGroup ?? null,
    classYear: normalizeClassYear(p),
    hometown,
    state: stateMatch?.[1],
    tags,
    slug: p.slug,
    jersey: p.jersey != null && Number.isFinite(Number(p.jersey)) ? Number(p.jersey) : null,
  };
}

async function fetchCoachingStaff(): Promise<Coach[]> {
  try {
    const data = await snapshotFirstFetch('/api/team/coaching-staff', () =>
      snapshotLiveFetch<StaffApiResponse>('/api/team/coaching-staff')
    );
    const coaching: Coach[] = (data.coaches ?? []).map((c) => ({
      id: c.id,
      initials: coachInitials(c.name),
      name: c.name,
      title: c.title,
      group: 'coaching' as const,
      bio: c.bio,
      highlights: c.highlights,
    }));
    const analysts: Coach[] = (data.analysts ?? []).map((a) => ({
      id: a.id,
      initials: coachInitials(a.name),
      name: a.name,
      title: a.title,
      group: 'coaching' as const,
    }));
    const support: Coach[] = (data.supportStaff ?? []).map((s, i) => ({
      id: `support-${i}`,
      initials: coachInitials(s.name),
      name: s.name,
      title: s.role,
      group: 'support' as const,
    }));
    const merged = [...coaching, ...analysts, ...support];
    return merged.length ? merged : FALLBACK_COACHES.map((c) => ({ ...c }));
  } catch {
    return FALLBACK_COACHES.map((c) => ({ ...c }));
  }
}

async function fetchDepthChartMeta(): Promise<{
  playerCount?: number;
  updatedAt?: string;
  units?: { offense?: number; defense?: number };
} | null> {
  try {
    const res = await fetch('/data/roster/depth-chart-meta.json');
    if (!res.ok) return null;
    return (await res.json()) as {
      playerCount?: number;
      updatedAt?: string;
      units?: { offense?: number; defense?: number };
    };
  } catch {
    return null;
  }
}

function countRosterUnits(roster: TeamPlayer[]): { offense: number; defense: number } {
  let offense = 0;
  let defense = 0;
  for (const p of roster) {
    const group = String(p.positionGroup ?? p.position ?? '').toLowerCase();
    if (group.includes('off') || /^(qb|rb|wr|te|ol|lt|lg|rg|rt|c|fb)/.test(group)) offense += 1;
    else if (group.includes('def') || /^(dl|lb|db|cb|s|de|dt|edge|jack|mike|will|sam|star|ss|fs|nb)/.test(group)) {
      defense += 1;
    }
  }
  return { offense, defense };
}

async function fetchTeamHubBundleLive(): Promise<TeamHubBundle> {
  const [rosterResult, coaches, meta, depthResult] = await Promise.allSettled([
    fetchWithWarmPoll(
      () =>
        snapshotLiveFetch<{ players?: RosterPlayer[] }>('/api/roster/players', DEFAULT_SNAPSHOT_FETCH_OPTS).then(
          (data) => (data.players ?? []).map(mapRosterPlayer).sort((a, b) => a.name.localeCompare(b.name))
        ),
      warmPollProfile()
    ).catch(() => [] as TeamPlayer[]),
    fetchCoachingStaff(),
    fetchDepthChartMeta(),
    fetchDepthChartBoard(),
  ]);

  const roster = rosterResult.status === 'fulfilled' ? rosterResult.value : [];
  const depthBoard: DepthChartBoard =
    depthResult.status === 'fulfilled' ? depthResult.value : fallbackDepthChartBoard();
  const liveDepth =
    depthBoard.depthChart.offense.length > 0 ? depthBoard.depthChart : TEAM_DEPTH_CHART;
  const metaData = meta.status === 'fulfilled' ? meta.value : null;
  const unitCounts = countRosterUnits(roster);
  const commandStats = computeTeamCommandStats(roster, liveDepth, metaData);
  commandStats.offenseCount = metaData?.units?.offense ?? unitCounts.offense;
  commandStats.defenseCount = metaData?.units?.defense ?? unitCounts.defense;

  return {
    eras: TEAM_ERAS,
    achievements: TEAM_ACHIEVEMENTS,
    identity: TEAM_IDENTITY,
    coaches: coaches.status === 'fulfilled' ? coaches.value : FALLBACK_COACHES.map((c) => ({ ...c })),
    roster,
    depthChart: liveDepth,
    depthLabel: depthBoard.label,
    depthSubtitle: depthBoard.subtitle,
    commandStats,
    updatedAt: depthBoard.updatedAt ?? metaData?.updatedAt ?? new Date().toISOString(),
  };
}

/** Cache-first Team hub: instant roster/staff on revisit, live refresh in background. */
export function fetchTeamHubBundle(opts?: {
  onFresh?: (bundle: TeamHubBundle) => void;
}): Promise<TeamHubBundle> {
  return cacheFirstFetch(TEAM_HUB_BUNDLE_CACHE_KEY, fetchTeamHubBundleLive, {
    isUsable: teamBundleUsable,
    onFresh: opts?.onFresh,
  });
}

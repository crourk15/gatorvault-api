import { getApiBase } from './big-board-api';
import { fetchRosterPlayers, type RosterPlayer } from './roster-api';
import {
  FALLBACK_COACHES,
  TEAM_ACHIEVEMENTS,
  TEAM_DEPTH_CHART,
  TEAM_ERAS,
  TEAM_IDENTITY,
  coachInitials,
} from './team-hub-data';
import type { Coach, DepthChart, Era, Achievement, IdentityBlock, TeamPlayer } from './team-hub-types';

export type TeamHubBundle = {
  eras: Era[];
  achievements: Achievement[];
  identity: IdentityBlock[];
  coaches: Coach[];
  roster: TeamPlayer[];
  depthChart: DepthChart;
  updatedAt: string | null;
};

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
  };
}

async function fetchCoachingStaff(): Promise<Coach[]> {
  const base = getApiBase();
  const url = base ? `${base}/api/team/coaching-staff` : '/data/coaching-staff.json';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as StaffApiResponse;
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

export async function fetchTeamHubBundle(): Promise<TeamHubBundle> {
  const [rosterResult, coaches] = await Promise.allSettled([
    fetchRosterPlayers(),
    fetchCoachingStaff(),
  ]);

  const roster =
    rosterResult.status === 'fulfilled'
      ? rosterResult.value.map(mapRosterPlayer).sort((a, b) => a.name.localeCompare(b.name))
      : [];

  return {
    eras: TEAM_ERAS,
    achievements: TEAM_ACHIEVEMENTS,
    identity: TEAM_IDENTITY,
    coaches: coaches.status === 'fulfilled' ? coaches.value : FALLBACK_COACHES.map((c) => ({ ...c })),
    roster,
    depthChart: TEAM_DEPTH_CHART,
    updatedAt: new Date().toISOString(),
  };
}

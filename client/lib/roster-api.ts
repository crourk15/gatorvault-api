import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';

export type ProductionStatCategory =
  | 'passing'
  | 'rushing'
  | 'receiving'
  | 'defense'
  | 'kicking'
  | 'punting'
  | 'returning';

export interface ProductionSeasonLine {
  season: number;
  team: string;
  category: ProductionStatCategory | string;
  stats: Record<string, number>;
}

export interface ProductionGameLine {
  season: number;
  week: number | null;
  date: string | null;
  opponent: string;
  homeAway: 'home' | 'away' | 'neutral' | null;
  category?: ProductionStatCategory | string;
  stats: Record<string, number>;
}

export interface ProductionStats {
  source: 'cfbd';
  syncedAt: string | null;
  cfbdPlayerId: number | null;
  matchConfidence: 'exact' | 'high' | null;
  seasons: ProductionSeasonLine[];
  recentGames: ProductionGameLine[];
}

export interface RosterPlayer {
  id: string;
  slug: string;
  name: string;
  pos?: string;
  position?: string;
  positionGroup?: string | null;
  year?: string;
  class?: string;
  height?: string;
  weight?: string;
  hometown?: string;
  unit?: string;
  depthChartTier?: string;
  headshotUrl?: string | null;
  vaultGrade?: number | null;
  lifecycle?: string;
  transferInfo?: string | null;
  injury?: string | null;
  bio?: string | null;
  jersey?: string | number | null;
  stars?: number | null;
  rank?: number | null;
  cfbdPlayerId?: number | null;
  productionStats?: ProductionStats | null;
}

export async function fetchRosterPlayers(): Promise<RosterPlayer[]> {
  const data = await snapshotFirstFetch('/api/roster/players', () =>
    snapshotLiveFetch<{ players?: RosterPlayer[] }>('/api/roster/players')
  );
  return data.players ?? [];
}

export async function fetchRosterPlayerBySlug(slug: string): Promise<RosterPlayer | null> {
  const path = `/api/roster/players/${encodeURIComponent(slug)}`;
  try {
    const data = await snapshotLiveFetch<{ player?: RosterPlayer }>(path);
    return data.player ?? null;
  } catch {
    return null;
  }
}

/** Roster players who arrived before portal era or are mis-tagged — hide portal badge */
const PORTAL_TAG_EXCLUDED_SLUGS = new Set([
  'cormani-mcclain',
  'brendan-bett',
  'kofi-asare',
  'alfonzo-allen-jr',
  'alfonzon-allen',
]);

/** True when player arrived via transfer portal. */
export function isPortalRosterPlayer(player: RosterPlayer): boolean {
  if (PORTAL_TAG_EXCLUDED_SLUGS.has(player.slug)) return false;
  const info = String(player.transferInfo ?? player.lifecycle ?? '').toLowerCase();
  return info.includes('portal') || info.includes('transfer');
}

export function portalRosterLabel(player: RosterPlayer): string | null {
  if (!isPortalRosterPlayer(player)) return null;
  const yr = player.year || player.class || '2026';
  const classYear = String(yr).match(/20\d{2}/)?.[0] ?? '2026';
  return `PORTAL (${classYear})`;
}

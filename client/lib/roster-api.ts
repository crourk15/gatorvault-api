import { getApiBase } from './big-board-api';

export interface RosterPlayer {
  id: string;
  slug: string;
  name: string;
  pos?: string;
  position?: string;
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
  bio?: string | null;
  jersey?: string | number | null;
  stars?: number | null;
  rank?: number | null;
}

export async function fetchRosterPlayers(): Promise<RosterPlayer[]> {
  const res = await fetch(`${getApiBase()}/api/roster/players`);
  if (!res.ok) throw new Error(`Roster API ${res.status}`);
  const data = (await res.json()) as { players?: RosterPlayer[] };
  return data.players ?? [];
}

export async function fetchRosterPlayerBySlug(slug: string): Promise<RosterPlayer | null> {
  const res = await fetch(`${getApiBase()}/api/roster/players/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Roster player API ${res.status}`);
  const data = (await res.json()) as { player?: RosterPlayer };
  return data.player ?? null;
}

/** True when player arrived via transfer portal. */
export function isPortalRosterPlayer(player: RosterPlayer): boolean {
  const info = String(player.transferInfo ?? player.lifecycle ?? '').toLowerCase();
  return info.includes('portal') || info.includes('transfer');
}

export function portalRosterLabel(player: RosterPlayer): string | null {
  if (!isPortalRosterPlayer(player)) return null;
  const yr = player.year || player.class || '2026';
  const classYear = String(yr).match(/20\d{2}/)?.[0] ?? '2026';
  return `PORTAL (${classYear})`;
}

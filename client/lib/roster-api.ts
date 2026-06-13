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
}

export async function fetchRosterPlayers(): Promise<RosterPlayer[]> {
  const res = await fetch(`${getApiBase()}/api/roster/players`);
  if (!res.ok) throw new Error(`Roster API ${res.status}`);
  const data = (await res.json()) as { players?: RosterPlayer[] };
  return data.players ?? [];
}

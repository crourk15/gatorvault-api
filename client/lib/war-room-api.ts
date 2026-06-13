import { getApiBase } from './big-board-api';

export interface WarRoomBreakdown {
  playerSlug: string;
  playerName: string;
  playerType?: string;
  projection?: string | null;
  insiderNotes?: string | null;
  staffNotes?: string | null;
  recruitingStory?: string | null;
  comparison?: string | null;
  schemeFit?: string | null;
}

export async function fetchWarRoomBreakdowns(): Promise<WarRoomBreakdown[]> {
  const res = await fetch(`${getApiBase()}/api/war-room/breakdowns`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`War Room breakdowns ${res.status}`);
  const data = (await res.json()) as { breakdowns?: WarRoomBreakdown[] };
  return data.breakdowns ?? [];
}

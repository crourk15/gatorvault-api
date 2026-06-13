/**
 * Scouting / War Room API — same-origin /api/war-room/breakdowns
 */
import { apiFetch } from './api-fetch';

export interface ScoutingBreakdown {
  playerSlug: string;
  playerName?: string;
  playerType?: string;
  featured?: boolean;
  sources?: string[];
  locked?: boolean;
  strengths?: string;
  weaknesses?: string;
  comparison?: string;
  projection?: string;
}

export interface ScoutingDatabaseResponse {
  ok: boolean;
  locked: boolean;
  count: number;
  breakdowns: ScoutingBreakdown[];
}

export async function fetchScoutingDatabase(
  playerType?: string
): Promise<ScoutingDatabaseResponse> {
  const qs = playerType ? `?playerType=${encodeURIComponent(playerType)}` : '';
  return apiFetch<ScoutingDatabaseResponse>(`/api/war-room/breakdowns${qs}`);
}

export function scoutingTypeLabel(type?: string): string {
  const map: Record<string, string> = {
    recruit: 'Recruit',
    commit: 'Commit',
    portal: 'Portal',
    target: 'Target',
    roster: 'Roster',
  };
  return map[type || ''] || 'Player';
}

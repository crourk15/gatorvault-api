/**
 * FutureCast alerts API client.
 */
import { getApiBase } from './big-board-api';

export interface FutureCastAlert {
  id: string;
  playerId: string;
  playerName: string;
  playerSlug: string;
  type: string;
  message: string;
  lifecycle?: string | null;
  createdAt: string;
  seen: boolean;
}

export async function fetchAlerts(limit = 50): Promise<FutureCastAlert[]> {
  const res = await fetch(`${getApiBase()}/api/alerts?limit=${limit}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `API ${res.status}`);
  }
  const data = (await res.json()) as { alerts: FutureCastAlert[] };
  return data.alerts;
}

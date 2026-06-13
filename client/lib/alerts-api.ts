/**
 * FutureCast alerts API client.
 */

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
  const { apiFetch } = await import('./api-fetch');
  const data = await apiFetch<{ alerts: FutureCastAlert[] }>(`/api/alerts?limit=${limit}`);
  return data.alerts;
}

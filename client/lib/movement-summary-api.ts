import { apiFetch } from '@/lib/api-fetch';

export type MovementSummary = {
  rising: number;
  falling: number;
  volatile: number;
  lastUpdated: string;
};

export async function fetchMovementSummary(): Promise<MovementSummary> {
  return apiFetch<MovementSummary>('/api/recruiting/movement-summary');
}

/**
 * FutureCast Big Board API client.
 * @see server/api/big-board/index.ts
 */
import type { RankingFields } from '@/types/futurecast';

export type BigBoardSort =
  | 'rank'
  | 'signals'
  | 'portalLikelihood'
  | 'ufFit'
  | 'name'
  | 'position';

export type BigBoardLifecycle = 'HS' | 'COLLEGE' | 'PORTAL';

export interface BigBoardPlayer extends RankingFields {
  id: string;
  fullName: string;
  slug: string;
  classYear: number;
  position: string;
  lifecycle: BigBoardLifecycle;
  committedTo?: string | null;
  portalStatus: string | null;
  signalCount: number;
  portalLikelihood: number;
  ufFitScore: number;
  rank: number;
  inState?: boolean;
  school?: string | null;
  state?: string | null;
}

export interface BigBoardQuery {
  class_year?: number;
  position?: string;
  lifecycle?: BigBoardLifecycle;
  sort?: BigBoardSort;
  order?: 'asc' | 'desc';
  limit?: number;
}

export interface BigBoardResponse {
  players: BigBoardPlayer[];
}

import { getApiBase } from './api-base';

export { getApiBase };

export function buildBigBoardUrl(query: BigBoardQuery = {}): string {
  const params = new URLSearchParams();
  if (query.class_year != null) params.set('class_year', String(query.class_year));
  if (query.position) params.set('position', query.position);
  if (query.lifecycle) params.set('lifecycle', query.lifecycle);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return `${getApiBase()}/api/big-board${qs ? `?${qs}` : ''}`;
}

export async function fetchBigBoard(query: BigBoardQuery = {}): Promise<BigBoardResponse> {
  const { apiFetch } = await import('./api-fetch');
  const params = new URLSearchParams();
  if (query.class_year != null) params.set('class_year', String(query.class_year));
  if (query.position) params.set('position', query.position);
  if (query.lifecycle) params.set('lifecycle', query.lifecycle);
  if (query.sort) params.set('sort', query.sort);
  if (query.order) params.set('order', query.order);
  if (query.limit != null) params.set('limit', String(query.limit));
  const qs = params.toString();
  return apiFetch<BigBoardResponse>(`/api/big-board${qs ? `?${qs}` : ''}`);
}

/** Map API sort modes to tab presets (spec §4.1). */
export const TAB_SORT: Record<string, { sort: BigBoardSort; lifecycle?: BigBoardLifecycle }> = {
  rank: { sort: 'rank' },
  'top-targets': { sort: 'ufFit' },
  'early-discovery': { sort: 'signals', lifecycle: 'HS' },
  'portal-watchlist': { sort: 'portalLikelihood', lifecycle: 'PORTAL' },
  predictions: { sort: 'ufFit' },
  'movement-tracker': { sort: 'signals' },
};

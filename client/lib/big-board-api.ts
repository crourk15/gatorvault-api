/**
 * FutureCast Big Board API client.
 * @see server/api/big-board/index.ts
 */

export type BigBoardSort =
  | 'rank'
  | 'signals'
  | 'portalLikelihood'
  | 'ufFit'
  | 'name'
  | 'position';

export type BigBoardLifecycle = 'HS' | 'COLLEGE' | 'PORTAL';

export interface BigBoardPlayer {
  id: string;
  fullName: string;
  slug: string;
  classYear: number;
  position: string;
  lifecycle: BigBoardLifecycle;
  portalStatus: string | null;
  signalCount: number;
  portalLikelihood: number;
  ufFitScore: number;
  rank: number;
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

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const gv = (window as Window & { GV_API_BASE?: string }).GV_API_BASE;
    if (gv) return gv.replace(/\/$/, '');
  }
  return '';
}

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
  const res = await fetch(buildBigBoardUrl(query));
  if (!res.ok) {
    let message = `Big Board request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return res.json() as Promise<BigBoardResponse>;
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

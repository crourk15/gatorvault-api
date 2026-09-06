/**
 * Maps live API paths to Netlify static snapshot JSON paths (disabled when LIVE_DATA_ONLY).
 * Hub snapshots: /hub-snapshot/* · Page snapshots: /page-snapshot/*
 */
import { LIVE_DATA_ONLY } from './data-mode';

export const PAGE_SNAPSHOT_ROOT = '/page-snapshot';
export const HUB_SNAPSHOT_ROOT = '/hub-snapshot';
const HUB_YEAR = 2027;

function splitPathQuery(apiPath: string): { path: string; params: URLSearchParams } {
  const raw = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const qIdx = raw.indexOf('?');
  const path = qIdx >= 0 ? raw.slice(0, qIdx) : raw;
  const params = new URLSearchParams(qIdx >= 0 ? raw.slice(qIdx + 1) : '');
  return { path, params };
}

function hubSnapshotPath(path: string, params: URLSearchParams): string | null {
  if (path === '/api/recruiting/hub/class-overview/all') {
    return `${HUB_SNAPSHOT_ROOT}/class-overview-all.json`;
  }
  const match = path.match(/^\/api\/recruiting\/hub\/([^/]+)$/);
  if (!match) return null;
  const endpoint = match[1];
  const year = params.get('year') || String(HUB_YEAR);
  return `${HUB_SNAPSHOT_ROOT}/${year}/${endpoint}.json`;
}

function pageSnapshotPath(path: string, params: URLSearchParams): string | null {
  const root = PAGE_SNAPSHOT_ROOT;

  if (path === '/api/live/ticker') return `${root}/home/ticker.json`;
  if (path === '/api/content/latest') return `${root}/home/content-latest.json`;

  if (path === '/api/recruiting/board') {
    const year = params.get('class') || params.get('classYear') || '2027';
    return `${root}/home/recruiting-board-${year}.json`;
  }

  if (path === '/api/content/published') return `${root}/articles/published.json`;
  if (path === '/api/film-room/catalog') return `${root}/film-room/catalog.json`;
  if (path === '/api/film-room/reviews') return `${root}/film-room/reviews.json`;
  if (path === '/api/nil/dashboard') return `${root}/nil/dashboard.json`;
  if (path === '/api/staff/dashboard') return `${root}/home/staff-dashboard.json`;
  if (path === '/api/betting/lines') return `${root}/game-zone/betting-lines.json`;
  if (path === '/api/futurecast/heatmap') return `${root}/futurecast/movement-intel.json`;
  if (path === '/api/recruiting/movement-intel') return `${root}/futurecast/movement-intel.json`;
  if (path === '/api/roster/players') return `${root}/teams/roster-players.json`;
  if (path === '/api/team/coaching-staff') return `${root}/teams/coaching-staff.json`;

  if (path === '/api/live/dashboard') return `${root}/gatornation-live/dashboard.json`;

  if (path === '/api/futurecast/home') return `${root}/futurecast/home.json`;
  if (path === '/api/futurecast/class') {
    const year = params.get('year') || '2027';
    return `${root}/futurecast/class-${year}.json`;
  }
  if (path === '/api/futurecast/predictions') {
    const year = params.get('year') || '2027';
    const limit = params.get('limit') || '6';
    return `${root}/futurecast/predictions-${year}-limit${limit}.json`;
  }
  if (path === '/api/futurecast/master-board') return `${root}/futurecast/master-board.json`;
  if (path === '/api/futurecast/trending') return `${root}/futurecast/trending.json`;
  if (path === '/api/futurecast/movement-intel') return `${root}/futurecast/movement-intel.json`;
  if (path === '/api/futurecast/staff-notes') {
    const year = params.get('year') || '2027';
    return `${root}/futurecast/staff-notes-${year}.json`;
  }
  if (path === '/api/futurecast/high-priority') {
    const year = params.get('year') || '2027';
    return `${root}/futurecast/high-priority-${year}.json`;
  }
  if (path === '/api/futurecast/stock') return `${root}/futurecast/stock.json`;
  if (path === '/api/futurecast/snapshots') return `${root}/futurecast/snapshots.json`;
  if (path === '/api/futurecast/targets') {
    const year = params.get('class_year') || params.get('year') || '2027';
    return `${root}/futurecast/targets-${year}.json`;
  }
  if (path === '/api/futurecast/underclassmen') return `${root}/futurecast/underclassmen.json`;

  return null;
}

/** Resolve static snapshot path for a same-origin API path (client only). */
export function snapshotPathForApi(apiPath: string): string | null {
  if (LIVE_DATA_ONLY || typeof window === 'undefined') return null;
  const { path, params } = splitPathQuery(apiPath);
  return hubSnapshotPath(path, params) ?? pageSnapshotPath(path, params);
}

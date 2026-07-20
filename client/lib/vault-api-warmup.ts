/**
 * vault-api-warmup — minimal API wake (hub bundle is the primary cache prime).
 */
import { apiFetch } from './api-fetch';
import { ACTIVE_RECRUITING_CLASS_YEAR } from './recruiting-cycle';

let warmed = false;
const warmedRecruitingApi = new Set<number>();

function hubYearFromPath(path: string): number {
  const match = path.match(/\/vault\/recruiting\/(\d{4})(?:\/|$)/);
  if (match) {
    const year = parseInt(match[1], 10);
    if ([2026, 2027, 2028].includes(year)) return year;
  }
  return ACTIVE_RECRUITING_CLASS_YEAR;
}

/** Prime recruiting hub bundle before navigation — safe on hover/touch. */
export function warmRecruitingHubApi(year = ACTIVE_RECRUITING_CLASS_YEAR): void {
  if (typeof window === 'undefined') return;
  if (warmedRecruitingApi.has(year)) return;
  warmedRecruitingApi.add(year);
  void apiFetch(`/api/recruiting/hub/bundle?year=${year}`, {
    timeoutMs: 20_000,
    retries: 2,
    retryDelayMs: 2_000,
  }).catch(() => {});
}

export function warmVaultApi(): void {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const hubYear = hubYearFromPath(path);

  const ping = (apiPath: string) =>
    apiFetch(apiPath, { timeoutMs: 15_000, retries: 2, retryDelayMs: 2_000 }).catch(() => null);

  // Ping first so Render wakes before the heavier hub bundle.
  void ping('/api/ping').then(() => {
    void ping(`/api/recruiting/hub/bundle?year=${hubYear}`);
    if (path.startsWith('/vault/film-room')) void ping('/api/film-room/catalog');
    if (path.startsWith('/vault/nil')) void ping('/api/nil/dashboard');
    if (path.startsWith('/vault/alerts')) void ping('/api/futurecast/alerts?limit=20');
    if (path.startsWith('/vault/articles')) void ping('/api/articles/published?limit=12');
    if (path.startsWith('/vault/game-zone')) void ping('/api/betting/lines');
    if (path.startsWith('/vault/depth-chart') || path.startsWith('/vault/team')) {
      void ping('/api/roster/players');
    }
  });

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(
      () => {
        if (path.startsWith('/vault/futurecast')) void ping('/api/futurecast/home');
        if (path.startsWith('/vault/community')) void ping('/api/community/categories');
        if (path.startsWith('/vault/live')) void ping('/api/live/dashboard?limit=20');
        if (path.startsWith('/vault/schedule') || path.startsWith('/vault/tickets')) {
          void ping('/api/betting/lines');
        }
        if (path.startsWith('/vault/membership')) void ping('/api/subscription/catalog');
      },
      { timeout: 2000 }
    );
  }
}

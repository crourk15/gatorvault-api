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

  const ping = (apiPath: string) => {
    void apiFetch(apiPath, { timeoutMs: 15_000, retries: 2, retryDelayMs: 2_000 }).catch(() => {});
  };

  ping('/api/ping');
  ping(`/api/recruiting/hub/bundle?year=${hubYear}`);

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(
      () => {
        if (path.startsWith('/vault/futurecast')) ping('/api/futurecast/home');
        if (path.startsWith('/vault/community')) ping('/api/community/categories');
      },
      { timeout: 2000 }
    );
  }
}

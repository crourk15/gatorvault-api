/**
 * Wake Render API before page data fetches — critical on cold start after idle.
 */
import { apiFetch } from './api-fetch';
import { ACTIVE_RECRUITING_CLASS_YEAR, RECRUITING_CLASS_YEARS } from './recruiting-cycle';

let warmed = false;

function hubYearFromPath(path: string): number {
  const match = path.match(/\/vault\/recruiting\/(\d{4})(?:\/|$)/);
  if (match) {
    const year = parseInt(match[1], 10);
    if (RECRUITING_CLASS_YEARS.includes(year as (typeof RECRUITING_CLASS_YEARS)[number])) {
      return year;
    }
  }
  return ACTIVE_RECRUITING_CLASS_YEAR;
}

export function warmVaultApi(): void {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const onRecruitingHub = path.startsWith('/vault/recruiting');
  const onFutureCast = path.startsWith('/vault/futurecast');
  const hubYear = hubYearFromPath(path);

  const ping = (apiPath: string) => {
    void apiFetch(apiPath, { timeoutMs: 15_000, retries: 2, retryDelayMs: 2_000 }).catch(() => {});
  };

  // Immediate wake — health first, then route-critical hub caches.
  ping('/api/ping');
  ping('/api/health');
  ping(`/api/recruiting/hub/bundle?year=${hubYear}`);
  for (const year of RECRUITING_CLASS_YEARS) {
    ping(`/api/recruiting/class-metrics?year=${year}`);
  }
  if (!onRecruitingHub) {
    ping(`/api/recruiting/hub/ticker?year=${hubYear}`);
  }
  if (!onFutureCast) {
    ping('/api/futurecast/master-board');
  }
  ping('/api/roster/players?limit=1');
  ping('/api/team/coaching-staff');
  ping('/api/community/categories');
  ping('/api/community/pulse');
  ping('/api/subscription/catalog');

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(
      () => {
        ping('/api/recruiting/intel/high-priority');
        ping('/api/staff/dashboard');
        ping('/api/community/threads?limit=1');
      },
      { timeout: 1500 }
    );
  } else {
    window.setTimeout(() => {
      ping('/api/recruiting/intel/high-priority');
      ping('/api/staff/dashboard');
      ping('/api/community/threads?limit=1');
    }, 400);
  }
}

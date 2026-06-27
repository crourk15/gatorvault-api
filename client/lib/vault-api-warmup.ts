/**
 * Wake Render API before page data fetches — critical on cold start after idle.
 */
import { apiFetch } from './api-fetch';

let warmed = false;

export function warmVaultApi(): void {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const onRecruitingHub = path.startsWith('/vault/recruiting');
  const onFutureCast = path.startsWith('/vault/futurecast');

  const ping = (apiPath: string) => {
    void apiFetch(apiPath, { timeoutMs: 15_000, retries: 2, retryDelayMs: 2_000 }).catch(() => {});
  };

  // Immediate wake — health/ping first; hub ticker primes recruiting cache.
  ping('/api/ping');
  ping('/api/health');
  if (!onRecruitingHub) {
    ping('/api/recruiting/hub/ticker?year=2027');
    ping('/api/recruiting/hub/bundle?year=2027');
    for (const year of [2026, 2027, 2028]) {
      ping(`/api/recruiting/class-metrics?year=${year}`);
    }
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

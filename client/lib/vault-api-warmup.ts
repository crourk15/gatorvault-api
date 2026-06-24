/**
 * Wake Render API before page data fetches — critical on cold start after idle.
 */
import { apiFetch } from './api-fetch';

let warmed = false;

export function warmVaultApi(): void {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;

  const ping = (path: string) => {
    void apiFetch(path, { timeoutMs: 15_000, retries: 2, retryDelayMs: 2_000 }).catch(() => {});
  };

  // Immediate wake — health/ping first; hub ticker primes recruiting cache.
  ping('/api/ping');
  ping('/api/health');
  ping('/api/recruiting/hub/ticker?year=2027');
  ping('/api/recruiting/hub/bundle?year=2027');
  ping('/api/futurecast/master-board');
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

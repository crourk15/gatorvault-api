/**
 * Wake Render API before first user interaction.
 */
import { apiFetch } from './api-fetch';

let warmed = false;

export function warmVaultApi(): void {
  if (typeof window === 'undefined' || warmed) return;
  warmed = true;

  const ping = (path: string) => {
    void apiFetch(path, { timeoutMs: 12_000 }).catch(() => {});
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(
      () => {
        ping('/api/recruiting/intel/high-priority');
        ping('/api/staff/dashboard');
      },
      { timeout: 4000 }
    );
  } else {
    window.setTimeout(() => {
      ping('/api/recruiting/intel/high-priority');
      ping('/api/staff/dashboard');
    }, 800);
  }
}

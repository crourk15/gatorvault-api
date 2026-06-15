import type { AuthSession } from './auth-api';
import { isAdminAccount } from './auth-api';

/** Client-side admin detection (PIN session or operator email). */
export function isVaultAdmin(session: AuthSession | null): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (sessionStorage.getItem('gv_admin_pin') || sessionStorage.getItem('gv_ops_pin')) {
      return true;
    }
    if (localStorage.getItem('gv_admin_access') === '1') {
      return true;
    }
  } catch {
    /* private mode / quota */
  }

  return isAdminAccount(session?.email);
}

export { isAdminAccount, effectiveTier } from './auth-api';

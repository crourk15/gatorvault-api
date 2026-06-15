import type { AuthSession } from './auth-api';

/** Client-side admin detection for vault sidebar + console access. */
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

  if (session?.tier === 'war') return true;

  const email = session?.email?.trim().toLowerCase() ?? '';
  if (!email) return false;

  return (
    email.endsWith('@gatorvaultinsider.com') ||
    email === 'gatorvaultinsider@gmail.com' ||
    email.includes('crourk')
  );
}

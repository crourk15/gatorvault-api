/**
 * Operator / War Room admin PIN login — mirrors legacy landing-page Admin Access.
 */
import { getApiBase } from './big-board-api';
import { saveSession, type AuthSession } from './auth-api';

const ADMIN_PIN_KEY = 'gv_admin_pin';
const ADMIN_ACCESS_KEY = 'gv_admin_access';

export function persistOperatorAccess(pin: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(ADMIN_PIN_KEY, pin);
    localStorage.setItem(ADMIN_ACCESS_KEY, '1');
  } catch {
    /* private mode */
  }
}

export function clearOperatorAccess(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(ADMIN_PIN_KEY);
    localStorage.removeItem(ADMIN_ACCESS_KEY);
  } catch {
    /* ignore */
  }
}

/** Verify admin PIN server-side and mint a War Room operator session. */
export async function loginWithOperatorPin(pin: string): Promise<AuthSession> {
  const res = await fetch(`${getApiBase()}/api/operator/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: pin.trim() }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string; session?: AuthSession };
  if (!res.ok || !data.session) {
    throw new Error(data.error || 'Invalid admin PIN.');
  }
  persistOperatorAccess(pin.trim());
  saveSession(data.session);
  try {
    sessionStorage.setItem('gv_auth_handoff', '1');
  } catch {
    /* ignore */
  }
  return data.session;
}

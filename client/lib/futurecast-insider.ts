import { loadSession, type AuthSession } from './auth-api';
import { effectiveTier } from './auth-api';

/** FutureCast Insider — paid tier (war / film) or active trial. */
export function isFutureCastInsider(session?: AuthSession | null): boolean {
  const s = session ?? (typeof window !== 'undefined' ? loadSession() : null);
  if (!s?.email) return false;
  const tier = String(effectiveTier(s) || '').toLowerCase();
  if (tier === 'war' || tier === 'film' || tier === 'locker') return true;
  if (s.trialEndISO) {
    const end = new Date(s.trialEndISO).getTime();
    if (!Number.isNaN(end) && end > Date.now()) return true;
  }
  return false;
}

import { loadSession, type AuthSession } from './auth-api';
import { hasPaymentTier } from './pricing-tiers';

/** True while an unpaid trial window is still open. */
export function hasActiveTrial(session?: AuthSession | null): boolean {
  const s = session ?? (typeof window !== 'undefined' ? loadSession() : null);
  if (!s?.email) return false;
  if (s.paid === true) return false;
  if (s.accessActive === false) return false;
  if (s.trialEndISO) {
    const end = Date.parse(s.trialEndISO);
    if (Number.isFinite(end) && end > Date.now()) return true;
  }
  if (typeof s.daysLeft === 'number' && s.daysLeft > 0) return true;
  return false;
}

/**
 * FutureCast / Film Insider — paid Film+ **or** active trial.
 * Trial opens all Film soft gates (Game Week depth, Vault Scouting, 2029–30).
 */
export function isFutureCastInsider(session?: AuthSession | null): boolean {
  const s = session ?? (typeof window !== 'undefined' ? loadSession() : null);
  if (!s?.email) return false;
  if (hasPaymentTier(s, 'film')) return true;
  return hasActiveTrial(s);
}

/** Film Room + Game Week — same Film tier gate as FutureCast. */
export const isFilmRoomInsider = isFutureCastInsider;

import { loadSession, type AuthSession } from './auth-api';
import { hasPaymentTier } from './pricing-tiers';

/** FutureCast Insider — Film Room tier or above (includes Film/War trials). */
export function isFutureCastInsider(session?: AuthSession | null): boolean {
  const s = session ?? (typeof window !== 'undefined' ? loadSession() : null);
  if (!s?.email) return false;
  return hasPaymentTier(s, 'film');
}

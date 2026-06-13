/** Vault points — compatible with monolith localStorage `gv_vaultPoints`. */

const STORAGE_KEY = 'gv_vaultPoints';

export type PointsTierId = 'scout' | 'insider' | 'elite';

export const POINTS_TIERS = {
  scout: { id: 'scout' as const, name: 'Scout', icon: '🔍', min: 0, max: 499 },
  insider: { id: 'insider' as const, name: 'Insider', icon: '📰', min: 500, max: 1999 },
  elite: { id: 'elite' as const, name: 'Vault Elite', icon: '⚡', min: 2000, max: null as number | null },
};

export function getVaultPoints(): number {
  if (typeof window === 'undefined') return 0;
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function setVaultPoints(total: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, String(Math.max(0, total)));
  } catch {
    /* ignore */
  }
}

export function addVaultPoints(pts: number): number {
  const total = getVaultPoints() + pts;
  setVaultPoints(total);
  return total;
}

export function getPointsTier(pts: number): PointsTierId {
  const n = Math.max(0, pts);
  if (n >= POINTS_TIERS.elite.min) return 'elite';
  if (n >= POINTS_TIERS.insider.min) return 'insider';
  return 'scout';
}

export function pointsProgressPct(pts: number): number {
  const tier = getPointsTier(pts);
  if (tier === 'elite') return 100;
  if (tier === 'insider') {
    return Math.min(100, Math.round(((pts - 500) / 1500) * 100));
  }
  return Math.min(100, Math.round((pts / 500) * 100));
}

export function nextTierLabel(pts: number): string {
  const tier = getPointsTier(pts);
  if (tier === 'elite') return 'Max tier reached';
  if (tier === 'insider') return `${POINTS_TIERS.elite.name} at ${POINTS_TIERS.elite.min} points`;
  return `${POINTS_TIERS.insider.name} at ${POINTS_TIERS.insider.min} points`;
}

export function hasOneTimeKey(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

export function markOneTimeKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

import seedJson from './alerts-hub-seed.json';
import type { FutureCastAlert } from './alerts-api';

export type AlertsHubSeed = {
  generatedAt: string;
  source: string;
  alerts: FutureCastAlert[];
};

export const ALERTS_HUB_SEED = seedJson as AlertsHubSeed;

/** Off-board phantoms that must never paint Board Intel first-paint. */
const BLOCKED_BOARD_INTEL_SLUGS = new Set([
  'ryan-peterson',
  'jalanie-george',
  'keoni-snipes',
  'zylen-little',
  'josiah-taylor',
]);

function isBlockedBoardIntelAlert(alert: FutureCastAlert): boolean {
  const slug = String(alert.playerSlug || alert.playerId || '')
    .toLowerCase()
    .trim();
  if (slug && BLOCKED_BOARD_INTEL_SLUGS.has(slug)) return true;
  const blob = `${alert.playerName || ''} ${alert.message || ''}`;
  return /\bryan\s+peterson\b/i.test(blob);
}

/** Static first-paint alerts — replaced by live refresh after hydrate. */
export function buildSeedAlerts(): FutureCastAlert[] {
  const rows = Array.isArray(ALERTS_HUB_SEED.alerts) ? ALERTS_HUB_SEED.alerts : [];
  return rows.filter((a) => !isBlockedBoardIntelAlert(a));
}

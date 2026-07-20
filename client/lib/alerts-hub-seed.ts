import seedJson from './alerts-hub-seed.json';
import type { FutureCastAlert } from './alerts-api';

export type AlertsHubSeed = {
  generatedAt: string;
  source: string;
  alerts: FutureCastAlert[];
};

export const ALERTS_HUB_SEED = seedJson as AlertsHubSeed;

/** Static first-paint alerts — replaced by live refresh after hydrate. */
export function buildSeedAlerts(): FutureCastAlert[] {
  return Array.isArray(ALERTS_HUB_SEED.alerts) ? ALERTS_HUB_SEED.alerts : [];
}

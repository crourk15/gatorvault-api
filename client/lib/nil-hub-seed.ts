import seedJson from './nil-hub-seed.json';
import type { NilDashboard } from './nil-api';
import type { HighPriorityPlayer } from './futurecast-high-priority-api';
import type { NilEliteBundle } from './nil-elite-api';

export type NilHubSeed = {
  generatedAt: string;
  source: string;
  dashboard: NilDashboard;
  players: HighPriorityPlayer[];
  elite?: NilEliteBundle;
};

export const NIL_HUB_SEED = seedJson as unknown as NilHubSeed;

/** Legacy seed shape — kept for older consumers. Prefer elite via useNilEliteData. */
export function buildSeedNilEliteBundle(): { dashboard: NilDashboard; players: HighPriorityPlayer[] } {
  return {
    dashboard: NIL_HUB_SEED.dashboard,
    players: Array.isArray(NIL_HUB_SEED.players) ? NIL_HUB_SEED.players : [],
  };
}

import seedJson from './nil-hub-seed.json';
import type { NilDashboard } from './nil-api';
import type { HighPriorityPlayer } from './futurecast-high-priority-api';

export type NilHubSeed = {
  generatedAt: string;
  source: string;
  dashboard: NilDashboard;
  players: HighPriorityPlayer[];
};

export const NIL_HUB_SEED = seedJson as unknown as NilHubSeed;

/** Static first-paint NIL Elite payload — replaced by live refresh after hydrate. */
export function buildSeedNilEliteBundle(): { dashboard: NilDashboard; players: HighPriorityPlayer[] } {
  return {
    dashboard: NIL_HUB_SEED.dashboard,
    players: Array.isArray(NIL_HUB_SEED.players) ? NIL_HUB_SEED.players : [],
  };
}

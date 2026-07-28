import seedJson from './gnl-hub-seed.json';
import type { LiveHubBundle } from './gatornation-live-api';
import { DEFAULT_PODCASTS } from './gatornation-live-api';

export type GnlHubSeed = {
  generatedAt: string;
  source: string;
  ticker: LiveHubBundle['ticker'];
  feed: LiveHubBundle['feed'];
  panels: LiveHubBundle['panels'];
};

export const GNL_HUB_SEED = seedJson as GnlHubSeed;

/** Static first-paint GNL bundle — replaced by live dashboard after hydrate. */
export function buildSeedLiveHubBundle(): LiveHubBundle {
  return {
    ticker: GNL_HUB_SEED.ticker ?? [],
    feed: GNL_HUB_SEED.feed ?? [],
    podcasts: DEFAULT_PODCASTS,
    panels: {
      visitsNow: GNL_HUB_SEED.panels?.visitsNow ?? [],
      portalBuzz: GNL_HUB_SEED.panels?.portalBuzz ?? [],
      beatWriterHighlights: GNL_HUB_SEED.panels?.beatWriterHighlights ?? [],
      staffNotes: GNL_HUB_SEED.panels?.staffNotes ?? [],
    },
    snapshot: {
      commits: 0,
      nationalRank: null,
      secRank: null,
      blueChips: 0,
      inStatePercent: 0,
      momentum: 0,
      momentumTrend: 'neutral',
    },
    movement: null,
    breakingNews: null,
    gameDay: null,
    updatedAt: GNL_HUB_SEED.generatedAt,
    refreshedAt: GNL_HUB_SEED.generatedAt,
  };
}

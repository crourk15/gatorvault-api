import seedJson from './community-hub-seed.json';
import type { CommunityCategory, CommunityPageData, CommunityPulse, CommunityThread, LiveRoom } from './community-api';

export type CommunityHubSeed = {
  generatedAt: string;
  source: string;
  categories: CommunityCategory[];
  threads: CommunityThread[];
  pulse: CommunityPulse;
  rooms: LiveRoom[];
};

export const COMMUNITY_HUB_SEED = seedJson as CommunityHubSeed;

/** Static first-paint community hub — replaced by live refresh after hydrate. */
export function buildSeedCommunityPageData(): CommunityPageData {
  return {
    categories: Array.isArray(COMMUNITY_HUB_SEED.categories) ? COMMUNITY_HUB_SEED.categories : [],
    threads: Array.isArray(COMMUNITY_HUB_SEED.threads) ? COMMUNITY_HUB_SEED.threads : [],
    pulse: COMMUNITY_HUB_SEED.pulse || {},
    rooms: Array.isArray(COMMUNITY_HUB_SEED.rooms) ? COMMUNITY_HUB_SEED.rooms : [],
  };
}

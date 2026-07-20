import seedJson from './futurecast-lab-seed.json';
import type { FutureCastLabDataMap } from './futurecast-lab-data';

export type FutureCastLabSeed = FutureCastLabDataMap & {
  generatedAt: string;
  source: string;
};

export const FUTURECAST_LAB_SEED = seedJson as unknown as FutureCastLabSeed;

/** Static first-paint FutureCast Lab map — replaced by live refresh after hydrate. */
export function buildSeedFutureCastLabData(): FutureCastLabDataMap {
  const { generatedAt: _generatedAt, source: _source, ...lab } = FUTURECAST_LAB_SEED;
  return lab;
}

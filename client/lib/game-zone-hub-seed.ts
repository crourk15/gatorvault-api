import seedJson from './game-zone-hub-seed.json';
import type { BettingGame } from './betting-api';

export type GameZoneHubSeed = {
  generatedAt: string;
  source: string;
  nextGame: BettingGame | null;
};

export const GAME_ZONE_HUB_SEED = seedJson as GameZoneHubSeed;

export function buildSeedNextGame(): BettingGame | null {
  return GAME_ZONE_HUB_SEED.nextGame || null;
}

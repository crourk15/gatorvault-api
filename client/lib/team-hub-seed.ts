import seedJson from './team-hub-seed.json';
import type { Coach, TeamPlayer } from './team-hub-types';

export type TeamHubSeed = {
  generatedAt: string;
  roster: TeamPlayer[];
  coaches: Coach[];
  meta: {
    updatedAt: string | null;
    playerCount: number;
    units?: { offense?: number; defense?: number; specialTeams?: number } | null;
  };
};

export const TEAM_HUB_SEED = seedJson as TeamHubSeed;

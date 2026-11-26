import seedJson from './portal-prep-seed.json';
import type { PortalSeasonState } from './recruiting-cycle';

export type FanPortalPrepRoom = {
  rank: number;
  room: string;
  tier: string;
  tierLabel: string;
  dek: string;
  hunt: string;
  alreadySigned: string[];
};

export type FanPortalPrep = {
  ok?: boolean;
  fanShip: boolean;
  status: string;
  namesLandWhen: string;
  season?: PortalSeasonState | null;
  window: {
    opens: string;
    closes: string;
    days: number;
    label: string;
    daysUntilOpen?: number | null;
  };
  thesis: {
    addCount: string;
    not: string;
    line: string;
  };
  rooms: FanPortalPrepRoom[];
  mustAdd: string[];
  incomingCount?: number;
};

type SeedFile = {
  generatedAt: string;
  prep: FanPortalPrep;
};

export const PORTAL_PREP_SEED = (seedJson as SeedFile).prep;

export function daysUntilPortalOpen(opens: string, at: Date = new Date()): number {
  const target = Date.parse(`${opens}T00:00:00Z`);
  if (!Number.isFinite(target)) return 0;
  const now = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
  return Math.max(0, Math.round((target - now) / 86400000));
}

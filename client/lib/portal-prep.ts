import seedJson from './portal-prep-seed.json';
import type { PortalSeasonState } from './recruiting-cycle';

export type FanPortalPrepChip = {
  name: string;
  slug?: string;
  position?: string;
  stars?: number | null;
  natlRank?: number | null;
  status?: 'commit' | 'target' | 'flip' | 'gap' | 'scan' | string;
  committedTo?: string | null;
  school?: string | null;
  conference?: string | null;
  pffGrade?: number | null;
  snaps?: number | null;
  ht?: string | null;
  wt?: number | null;
  jersey?: string | null;
  yearsLeft?: number | null;
  note?: string | null;
  announcedPortal?: boolean;
  productionPath?: string | null;
};

export type FanPortalPrepRoom = {
  rank: number;
  room: string;
  tier: string;
  tierLabel: string;
  dek: string;
  hunt: string;
  alreadySigned: Array<string | FanPortalPrepChip>;
  stillRecruiting?: Array<string | FanPortalPrepChip>;
  gapFillers?: Array<string | FanPortalPrepChip>;
  scanTargets?: Array<string | FanPortalPrepChip>;
};

export type FanPortalPrep = {
  ok?: boolean;
  fanShip: boolean;
  status: string;
  namesLandWhen: string;
  classYear?: number;
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

export function portalChip(row: string | FanPortalPrepChip | null | undefined): FanPortalPrepChip | null {
  if (!row) return null;
  if (typeof row === 'string') {
    const name = row.trim();
    return name ? { name, slug: '', status: 'commit' } : null;
  }
  const name = String(row.name || '').trim();
  if (!name) return null;
  return {
    name,
    slug: String(row.slug || '').trim(),
    position: row.position,
    stars: row.stars ?? null,
    natlRank: row.natlRank ?? null,
    status: row.status || 'commit',
    committedTo: row.committedTo ?? row.school ?? null,
    school: row.school ?? row.committedTo ?? null,
    conference: row.conference ?? null,
    pffGrade: row.pffGrade ?? null,
    snaps: row.snaps ?? null,
    ht: row.ht ?? null,
    wt: row.wt ?? null,
    jersey: row.jersey ?? null,
    yearsLeft: row.yearsLeft ?? null,
    note: row.note ?? null,
    announcedPortal: !!row.announcedPortal,
    productionPath: row.productionPath ?? null,
  };
}

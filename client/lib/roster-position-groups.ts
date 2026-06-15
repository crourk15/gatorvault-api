/** Roster filter groups — exact position codes only (no prefix matching). */

export type RosterPositionGroup = 'QB' | 'RB' | 'WR' | 'OL' | 'DL' | 'LB' | 'DB' | 'ST';

export type RosterFilter =
  | 'All'
  | 'QB'
  | 'RB'
  | 'WR'
  | 'OL'
  | 'DL'
  | 'LB'
  | 'DB'
  | 'ST';

const OL_POSITIONS = new Set(['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'IOL', 'OT', 'OG']);
const DB_POSITIONS = new Set(['CB', 'S', 'SS', 'FS', 'NB', 'DB', 'STAR']);
const DL_POSITIONS = new Set(['DL', 'DT', 'DE', 'EDGE', 'NT', 'END', 'NOSE']);
const LB_POSITIONS = new Set(['LB', 'MIKE', 'WILL', 'SAM', 'JACK', 'OLB', 'ILB']);
const RB_POSITIONS = new Set(['RB', 'FB']);
const WR_POSITIONS = new Set(['WR', 'TE']);
const ST_POSITIONS = new Set(['K', 'P', 'LS', 'KR', 'PR']);

function normalizePos(pos: string): string {
  return String(pos || '').toUpperCase().trim();
}

export function resolveRosterPositionGroup(
  pos: string,
  positionGroup?: string | null
): RosterPositionGroup | null {
  const group = String(positionGroup || '').toUpperCase().trim();
  if (
    group === 'OL' ||
    group === 'DB' ||
    group === 'DL' ||
    group === 'LB' ||
    group === 'RB' ||
    group === 'WR' ||
    group === 'QB' ||
    group === 'ST'
  ) {
    return group as RosterPositionGroup;
  }
  const p = normalizePos(pos);
  if (p === 'QB') return 'QB';
  if (RB_POSITIONS.has(p)) return 'RB';
  if (WR_POSITIONS.has(p)) return 'WR';
  if (OL_POSITIONS.has(p)) return 'OL';
  if (DL_POSITIONS.has(p)) return 'DL';
  if (LB_POSITIONS.has(p)) return 'LB';
  if (DB_POSITIONS.has(p)) return 'DB';
  if (ST_POSITIONS.has(p)) return 'ST';
  return null;
}

export function rosterMatchesFilter(
  pos: string,
  filter: RosterFilter,
  positionGroup?: string | null
): boolean {
  if (filter === 'All') return true;
  return resolveRosterPositionGroup(pos, positionGroup) === filter;
}

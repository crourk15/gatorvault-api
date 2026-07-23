/** Roster filter groups — exact position codes only (no prefix matching). */

export type RosterPositionGroup =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'DL'
  | 'EDGE'
  | 'LB'
  | 'CB'
  | 'S'
  | 'ST';

export type RosterFilter =
  | 'All'
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'DL'
  | 'EDGE'
  | 'LB'
  | 'CB'
  | 'S'
  | 'ST';

const OL_POSITIONS = new Set(['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'IOL', 'OT', 'OG']);
const DL_POSITIONS = new Set(['DL', 'DT', 'NT', 'NOSE', 'END']);
const EDGE_POSITIONS = new Set(['EDGE', 'DE', 'JACK', 'OLB']);
const LB_POSITIONS = new Set(['LB', 'MIKE', 'WILL', 'SAM', 'ILB']);
const CB_POSITIONS = new Set(['CB', 'NB', 'STAR', 'DB']);
const S_POSITIONS = new Set(['S', 'SS', 'FS']);
const RB_POSITIONS = new Set(['RB', 'FB']);
const WR_POSITIONS = new Set(['WR']);
const TE_POSITIONS = new Set(['TE', 'H', 'Y']);
const ST_POSITIONS = new Set(['K', 'P', 'LS', 'KR', 'PR']);

function normalizePos(pos: string): string {
  return String(pos || '').toUpperCase().trim();
}

/**
 * Resolve fine roster room from position code first.
 * Coarse API positionGroup (e.g. DB/DL) is only a fallback when the code is empty.
 */
export function resolveRosterPositionGroup(
  pos: string,
  positionGroup?: string | null
): RosterPositionGroup | null {
  const p = normalizePos(pos);
  if (p === 'QB') return 'QB';
  if (RB_POSITIONS.has(p)) return 'RB';
  if (TE_POSITIONS.has(p)) return 'TE';
  if (WR_POSITIONS.has(p)) return 'WR';
  if (OL_POSITIONS.has(p)) return 'OL';
  if (EDGE_POSITIONS.has(p)) return 'EDGE';
  if (DL_POSITIONS.has(p)) return 'DL';
  if (LB_POSITIONS.has(p)) return 'LB';
  if (CB_POSITIONS.has(p)) return 'CB';
  if (S_POSITIONS.has(p)) return 'S';
  if (ST_POSITIONS.has(p)) return 'ST';

  const group = String(positionGroup || '').toUpperCase().trim();
  if (group === 'QB') return 'QB';
  if (group === 'RB') return 'RB';
  if (group === 'TE') return 'TE';
  if (group === 'WR') return 'WR';
  if (group === 'OL') return 'OL';
  if (group === 'EDGE') return 'EDGE';
  if (group === 'DL') return 'DL';
  if (group === 'LB') return 'LB';
  if (group === 'CB') return 'CB';
  if (group === 'S') return 'S';
  if (group === 'ST') return 'ST';
  // Legacy coarse buckets from older clients / APIs
  if (group === 'DB') return 'CB';
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

/** Roster filter groups — exact position codes only (no prefix matching). */

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

function normalizePos(pos) {
  return String(pos || '').toUpperCase().trim();
}

function resolveRosterPositionGroup(pos, positionGroup) {
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
  if (['QB', 'RB', 'TE', 'WR', 'OL', 'EDGE', 'DL', 'LB', 'CB', 'S', 'ST'].includes(group)) {
    return group;
  }
  if (group === 'DB') return 'CB';
  return null;
}

function rosterMatchesFilter(pos, filter, positionGroup) {
  if (filter === 'All') return true;
  return resolveRosterPositionGroup(pos, positionGroup) === filter;
}

module.exports = {
  resolveRosterPositionGroup,
  rosterMatchesFilter,
};

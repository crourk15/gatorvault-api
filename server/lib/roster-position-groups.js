/** Roster filter groups — exact position codes only (no prefix matching). */

const OL_POSITIONS = new Set(['LT', 'LG', 'C', 'RG', 'RT', 'OL', 'IOL', 'OT', 'OG']);
const DB_POSITIONS = new Set(['CB', 'S', 'SS', 'FS', 'NB', 'DB', 'STAR']);
const DL_POSITIONS = new Set(['DL', 'DT', 'DE', 'EDGE', 'NT', 'END', 'NOSE']);
const LB_POSITIONS = new Set(['LB', 'MIKE', 'WILL', 'SAM', 'JACK', 'OLB', 'ILB']);
const RB_POSITIONS = new Set(['RB', 'FB']);
const WR_POSITIONS = new Set(['WR', 'TE']);
const ST_POSITIONS = new Set(['K', 'P', 'LS', 'KR', 'PR']);

function normalizePos(pos) {
  return String(pos || '').toUpperCase().trim();
}

function resolveRosterPositionGroup(pos, positionGroup) {
  const group = String(positionGroup || '').toUpperCase().trim();
  if (group === 'OL' || group === 'DB' || group === 'DL' || group === 'LB' || group === 'RB' || group === 'WR' || group === 'QB' || group === 'ST') {
    return group;
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

function rosterMatchesFilter(pos, filter, positionGroup) {
  if (!filter || filter === 'All') return true;
  return resolveRosterPositionGroup(pos, positionGroup) === filter;
}

module.exports = {
  resolveRosterPositionGroup,
  rosterMatchesFilter,
  OL_POSITIONS,
  DB_POSITIONS,
};

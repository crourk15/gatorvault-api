/**
 * Recruiting position buckets for related-player queries (WR + ATH, CB + DB, etc.).
 */

const BUCKET_POSITIONS = {
  QB: ['QB'],
  RB: ['RB', 'FB', 'ATH'],
  WR: ['WR', 'ATH'],
  TE: ['TE', 'ATH'],
  OL: ['OL', 'OT', 'OG', 'C', 'IOL'],
  DL: ['DL', 'DE', 'DT', 'EDGE', 'NT'],
  EDGE: ['EDGE', 'DE', 'OLB', 'LB'],
  LB: ['LB', 'ILB', 'OLB', 'MLB', 'EDGE'],
  DB: ['CB', 'S', 'DB', 'FS', 'SS', 'NB', 'ATH'],
  CB: ['CB', 'DB', 'S', 'ATH'],
  S: ['S', 'CB', 'DB', 'FS', 'SS', 'ATH'],
  ATH: ['ATH', 'WR', 'RB', 'CB', 'S', 'TE'],
  K: ['K', 'P', 'PK', 'LS'],
  P: ['P', 'K', 'PK'],
};

function normalizeRecruitingPosition(raw) {
  const token = String(raw || '')
    .toUpperCase()
    .trim()
    .split(/[/,s|]+/)[0]
    .replace(/[^A-Z0-9]/g, '');
  if (!token) return 'ATH';
  if (token === 'WIDE' || token === 'WIDERECEIVER') return 'WR';
  if (token === 'CORNER' || token === 'CORNERBACK') return 'CB';
  if (token === 'SAFETY') return 'S';
  if (token === 'DEFENSIVEEND') return 'DE';
  if (token === 'DEFENSIVETACKLE') return 'DT';
  if (token === 'LINEBACKER') return 'LB';
  if (token === 'TIGHTEND') return 'TE';
  if (token === 'RUNNINGBACK') return 'RB';
  if (token === 'QUARTERBACK') return 'QB';
  return token;
}

function recruitingPositionBucket(raw) {
  const pos = normalizeRecruitingPosition(raw);
  if (BUCKET_POSITIONS[pos]) return pos;
  if (['OT', 'OG', 'C', 'IOL'].includes(pos)) return 'OL';
  if (['DE', 'DT', 'NT'].includes(pos)) return 'DL';
  if (['ILB', 'OLB', 'MLB'].includes(pos)) return 'LB';
  if (['FS', 'SS', 'NB', 'DB'].includes(pos)) return 'DB';
  if (['FB'].includes(pos)) return 'RB';
  return pos;
}

function relatedPositionsFor(raw) {
  const bucket = recruitingPositionBucket(raw);
  const positions = BUCKET_POSITIONS[bucket] || [normalizeRecruitingPosition(raw)];
  return [...new Set(positions.map(normalizeRecruitingPosition).filter(Boolean))];
}

module.exports = {
  BUCKET_POSITIONS,
  normalizeRecruitingPosition,
  recruitingPositionBucket,
  relatedPositionsFor,
};

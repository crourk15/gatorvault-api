export type PositionIconKey =
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
  | 'ATH'
  | 'K/P';

export const POSITION_ALIASES: Record<string, PositionIconKey> = {
  QB: 'QB',
  RB: 'RB',
  FB: 'RB',
  WR: 'WR',
  TE: 'TE',
  OL: 'OL',
  OT: 'OL',
  OG: 'OL',
  C: 'OL',
  IOL: 'OL',
  DL: 'DL',
  DT: 'DL',
  DE: 'DL',
  IDL: 'DL',
  EDGE: 'EDGE',
  OLB: 'EDGE',
  LB: 'LB',
  ILB: 'LB',
  MLB: 'LB',
  CB: 'CB',
  S: 'S',
  SAF: 'S',
  FS: 'S',
  SS: 'S',
  ATH: 'ATH',
  APB: 'ATH',
  K: 'K/P',
  P: 'K/P',
  'K/P': 'K/P',
  PK: 'K/P',
};

export function normalizePosition(raw?: string | null): PositionIconKey {
  const token = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z/]/g, '');
  if (!token) return 'ATH';
  if (POSITION_ALIASES[token]) return POSITION_ALIASES[token];
  for (const [key, value] of Object.entries(POSITION_ALIASES)) {
    if (token.includes(key)) return value;
  }
  return 'ATH';
}

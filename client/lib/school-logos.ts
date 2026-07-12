/**
 * Resolve ESPN NCAA logos from school display names (recruiting / RPM boards).

 * Falls back to null when unknown — UI should show initials.
*/
import { espnTeamLogoUrl } from './team-logos';

/** Canonical school key → ESPN team id */
const SCHOOL_ESPN_IDS: Record<string, number> = {
  florida: 57,
  'florida gators': 57,
  uf: 57,
  gators: 57,
  alabama: 333,
  auburn: 2,
  georgia: 61,
  uga: 61,
  'georgia bulldogs': 61,
  lsu: 99,
  tennessee: 2633,
  texas: 251,
  'texas a&m': 245,
  'texas am': 245,
  oklahoma: 201,
  olemiss: 145,
  'ole miss': 145,
  mississippi: 145,
  'mississippi state': 344,
  missouri: 142,
  mizzou: 142,
  kentucky: 96,
  'south carolina': 2579,
  vanderbilt: 238,
  vandy: 238,
  arkansas: 8,
  miami: 2390,
  'miami fl': 2390,
  'florida state': 52,
  fsu: 52,
  clemson: 228,
  'north carolina': 153,
  unc: 153,
  'nc state': 152,
  'north carolina state': 152,
  duke: 150,
  'wake forest': 154,
  'virginia tech': 259,
  virginia: 258,
  louisville: 97,
  'notre dame': 87,
  oregon: 2483,
  'ohio state': 194,
  michigan: 130,
  'penn state': 213,
  usc: 30,
  'southern california': 30,
  ucla: 26,
  stanford: 24,
  washington: 264,
  colorado: 38,
  utah: 254,
  arizona: 12,
  'arizona state': 9,
  'oklahoma state': 197,
  baylor: 239,
  tcu: 2628,
  'texas tech': 2641,
  'kansas state': 2306,
  kansas: 2305,
  iowa: 2294,
  wisconsin: 275,
  nebraska: 158,
  minnesota: 135,
  illinois: 356,
  indiana: 84,
  'michigan state': 127,
  maryland: 120,
  rutgers: 164,
  northwestern: 77,
  purdue: 2509,
  cincinnati: 2132,
  'west virginia': 277,
  pittsburgh: 221,
  pitt: 221,
  syracuse: 183,
  'boston college': 103,
  'georgia tech': 59,
  usf: 58,
  'south florida': 58,
  ucf: 2116,
  'central florida': 2116,
  fau: 2226,
  'florida atlantic': 2226,
  charlotte: 2429,
  memphis: 235,
  tulane: 2655,
  smu: 2567,
  houston: 248,
  byu: 252,
  'iowa state': 66,
  'boise state': 68,
};

function normalizeSchoolKey(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function aliasKeys(normalized: string): string[] {
  const keys = [normalized];
  if (/texas\s*a\s*and\s*m|texas\s*am/.test(normalized)) {
    keys.push('texas a&m', 'texas am');
  }
  if (/^miami(\s*fl)?$/.test(normalized) || normalized === 'miami florida') {
    keys.push('miami', 'miami fl');
  }
  if (normalized === 'florida gators' || normalized === 'uf' || normalized === 'gators') {
    keys.push('florida');
  }
  if (normalized.includes('and')) {
    keys.push(normalized.replace(/\band\b/g, '&').replace(/\s+/g, ' ').trim());
  }
  return keys;
}

export function schoolEspnId(school?: string | null): number | null {
  if (!school) return null;
  const normalized = normalizeSchoolKey(school);
  if (!normalized) return null;
  for (const key of aliasKeys(normalized)) {
    if (SCHOOL_ESPN_IDS[key]) return SCHOOL_ESPN_IDS[key];
  }
  const first = normalized.split(' ')[0];
  if (
    first &&
    SCHOOL_ESPN_IDS[first] &&
    !['north', 'south', 'east', 'west', 'new', 'ole'].includes(first)
  ) {
    return SCHOOL_ESPN_IDS[first];
  }
  return null;
}

export function schoolLogoUrl(school?: string | null): string | null {
  const id = schoolEspnId(school);
  return id != null ? espnTeamLogoUrl(id) : null;
}

export function schoolLogoInitials(name?: string | null): string {
  if (!name) return '?';
  const cleaned = String(name).replace(/^the\s+/i, '').trim();
  if (!cleaned) return '?';
  const key = normalizeSchoolKey(cleaned);
  if (key === 'florida' || key === 'florida gators' || key === 'uf' || key === 'gators') return 'UF';
  if (key === 'georgia' || key === 'uga') return 'UGA';
  if (key === 'lsu') return 'LSU';
  if (key === 'ohio state') return 'OSU';
  if (key === 'usc' || key === 'southern california') return 'USC';
  return cleaned
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
}

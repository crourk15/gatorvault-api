import type {
  ProductionGameLine,
  ProductionSeasonLine,
  ProductionStats,
  RosterPlayer,
} from '@/lib/roster-api';

const PRIMARY_BY_POS: Record<string, string> = {
  QB: 'passing',
  RB: 'rushing',
  FB: 'rushing',
  HB: 'rushing',
  TB: 'rushing',
  WR: 'receiving',
  TE: 'receiving',
  ATH: 'receiving',
  K: 'kicking',
  PK: 'kicking',
  P: 'punting',
};

const STRIP_KEYS: Record<string, string[]> = {
  passing: ['cmp', 'att', 'yds', 'td'],
  rushing: ['car', 'yds', 'td', 'avg'],
  receiving: ['rec', 'yds', 'td', 'avg'],
  defense: ['tot', 'solo', 'sack', 'int'],
  kicking: ['fgm', 'fga', 'xpm', 'pts'],
  punting: ['punts', 'yds', 'avg', 'lng'],
  returning: ['kr', 'krYds', 'pr', 'prYds'],
};

const LABEL: Record<string, string> = {
  cmp: 'CMP',
  att: 'ATT',
  yds: 'YDS',
  td: 'TD',
  car: 'CAR',
  rec: 'REC',
  avg: 'AVG',
  tot: 'TOT',
  solo: 'SOLO',
  sack: 'SACK',
  int: 'INT',
  fgm: 'FGM',
  fga: 'FGA',
  xpm: 'XPM',
  pts: 'PTS',
  punts: 'PUNTS',
  lng: 'LNG',
  kr: 'KR',
  krYds: 'KR YDS',
  pr: 'PR',
  prYds: 'PR YDS',
};

export function primaryCategoryForRosterPos(pos?: string | null): string {
  const p = String(pos || '').toUpperCase().trim();
  return PRIMARY_BY_POS[p] || 'defense';
}

export function pickPrimarySeason(
  stats: ProductionStats | null | undefined,
  pos?: string | null
): ProductionSeasonLine | null {
  if (!stats?.seasons?.length) return null;
  const primary = primaryCategoryForRosterPos(pos);
  const currentYear = new Date().getUTCMonth() >= 7
    ? new Date().getUTCFullYear()
    : new Date().getUTCFullYear() - 1;
  const sameCat = stats.seasons.filter((s) => s.category === primary);
  const pool = sameCat.length ? sameCat : stats.seasons;
  return (
    pool.find((s) => s.season === currentYear) ||
    pool.slice().sort((a, b) => b.season - a.season)[0] ||
    null
  );
}

export function formatStatValue(key: string, value: number): string {
  if (key === 'avg') return Number(value).toFixed(1);
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 10) / 10);
}

export function seasonStripItems(
  line: ProductionSeasonLine | null
): { key: string; label: string; value: string }[] {
  if (!line) return [];
  const keys = STRIP_KEYS[line.category] || Object.keys(line.stats).slice(0, 4);
  const items: { key: string; label: string; value: string }[] = [];
  for (const key of keys) {
    if (line.stats[key] == null) continue;
    items.push({
      key,
      label: LABEL[key] || key.toUpperCase(),
      value: formatStatValue(key, line.stats[key]),
    });
    if (items.length >= 4) break;
  }
  return items;
}

export function formatGameStatLine(game: ProductionGameLine): string {
  const cat = String(game.category || '');
  const keys = STRIP_KEYS[cat] || Object.keys(game.stats);
  const parts: string[] = [];
  for (const key of keys) {
    if (game.stats[key] == null) continue;
    parts.push(`${LABEL[key] || key.toUpperCase()} ${formatStatValue(key, game.stats[key])}`);
    if (parts.length >= 4) break;
  }
  return parts.join(' · ') || '—';
}

export function formatSyncedAt(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export function hasProductionStats(player: RosterPlayer): boolean {
  const s = player.productionStats;
  if (!s || s.source !== 'cfbd') return false;
  return Boolean(s.seasons?.length || s.recentGames?.length);
}

export function careerSeasonsForPos(
  stats: ProductionStats | null | undefined,
  pos?: string | null
): ProductionSeasonLine[] {
  if (!stats?.seasons?.length) return [];
  const primary = primaryCategoryForRosterPos(pos);
  const same = stats.seasons.filter((s) => s.category === primary);
  const pool = same.length ? same : stats.seasons;
  return pool.slice().sort((a, b) => b.season - a.season);
}

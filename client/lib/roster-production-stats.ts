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
  passing: ['cmp', 'att', 'yds', 'td', 'int'],
  rushing: ['car', 'yds', 'td', 'avg'],
  receiving: ['rec', 'yds', 'td', 'avg'],
  defense: ['tot', 'solo', 'sack', 'int'],
  kicking: ['fgm', 'fga', 'xpm', 'pts'],
  punting: ['punts', 'yds', 'avg', 'lng'],
  returning: ['kr', 'krYds', 'pr', 'prYds'],
};

const CATEGORY_ORDER = ['passing', 'rushing', 'receiving', 'defense', 'kicking', 'punting', 'returning'];

export type GroupedProductionGame = {
  season: number;
  week: number | null;
  date: string | null;
  opponent: string;
  homeAway: ProductionGameLine['homeAway'];
  lines: ProductionGameLine[];
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

export function formatCmpAtt(stats: Record<string, number> | null | undefined): string | null {
  if (stats?.cmp == null || stats?.att == null) return null;
  return `${formatStatValue('cmp', stats.cmp)}/${formatStatValue('att', stats.att)}`;
}

export function seasonStripItems(
  line: ProductionSeasonLine | null
): { key: string; label: string; value: string }[] {
  if (!line) return [];
  const items: { key: string; label: string; value: string }[] = [];
  if (line.category === 'passing') {
    const combo = formatCmpAtt(line.stats);
    if (combo) items.push({ key: 'cmpatt', label: 'CMP/ATT', value: combo });
    for (const key of ['yds', 'td', 'int'] as const) {
      if (line.stats[key] == null) continue;
      items.push({
        key,
        label: LABEL[key],
        value: formatStatValue(key, line.stats[key]),
      });
    }
    return items;
  }
  const keys = STRIP_KEYS[line.category] || Object.keys(line.stats).slice(0, 4);
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
  if (cat === 'passing') {
    const combo = formatCmpAtt(game.stats);
    const parts: string[] = [];
    if (combo) parts.push(combo);
    for (const key of ['yds', 'td', 'int'] as const) {
      if (game.stats[key] == null) continue;
      parts.push(`${LABEL[key]} ${formatStatValue(key, game.stats[key])}`);
    }
    return parts.join(' · ') || '—';
  }
  const keys = STRIP_KEYS[cat] || Object.keys(game.stats);
  const parts: string[] = [];
  for (const key of keys) {
    if (game.stats[key] == null) continue;
    parts.push(`${LABEL[key] || key.toUpperCase()} ${formatStatValue(key, game.stats[key])}`);
    if (parts.length >= 4) break;
  }
  return parts.join(' · ') || '—';
}

export function categoryLabel(category?: string | null): string {
  const cat = String(category || '').trim();
  if (!cat) return '';
  return cat.replace(/^./, (c) => c.toUpperCase());
}

export function groupProductionGames(games: ProductionGameLine[] | null | undefined): GroupedProductionGame[] {
  const rows = Array.isArray(games) ? games : [];
  const groups = new Map<string, GroupedProductionGame>();
  for (const game of rows) {
    const key = `${game.season}|${game.week ?? ''}|${game.opponent}|${game.date ?? ''}`;
    const existing = groups.get(key);
    if (existing) {
      existing.lines.push(game);
      continue;
    }
    groups.set(key, {
      season: game.season,
      week: game.week ?? null,
      date: game.date ?? null,
      opponent: game.opponent,
      homeAway: game.homeAway ?? null,
      lines: [game],
    });
  }
  const ordered = [...groups.values()].map((group) => ({
    ...group,
    lines: group.lines.slice().sort(
      (a, b) => CATEGORY_ORDER.indexOf(String(a.category)) - CATEGORY_ORDER.indexOf(String(b.category))
    ),
  }));
  return ordered.sort((a, b) => {
    const weekA = a.week ?? 0;
    const weekB = b.week ?? 0;
    if (b.season !== a.season) return b.season - a.season;
    if (weekB !== weekA) return weekB - weekA;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
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

export function formatGameDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function formatGameOpponentLabel(game: ProductionGameLine): string {
  const opp = String(game.opponent || '').trim();
  const name = !opp || /^opponent$/i.test(opp) ? 'Opponent' : opp;
  const prefix = game.homeAway === 'away' ? '@ ' : game.homeAway === 'home' ? 'vs ' : '';
  return `${prefix}${name}`;
}

export function formatRecentGameHeadline(game: ProductionGameLine): string {
  const when = formatGameDate(game.date);
  const opp = formatGameOpponentLabel(game);
  return when ? `${when} · ${opp}` : opp;
}


const TRUSTED_PRODUCTION_SOURCES = new Set(['cfbd', 'official']);

export function hasProductionStats(player: RosterPlayer): boolean {
  const s = player.productionStats;
  if (!s || !TRUSTED_PRODUCTION_SOURCES.has(s.source)) return false;
  return Boolean(s.seasons?.length || s.recentGames?.length);
}

export function productionSourceLabel(source?: string | null): string {
  if (source === 'official') return 'Official box';
  return 'CollegeFootballData';
}

export function careerSeasonsForPos(
  stats: ProductionStats | null | undefined,
  pos?: string | null
): ProductionSeasonLine[] {
  if (!stats?.seasons?.length) return [];
  const primary = primaryCategoryForRosterPos(pos);
  const now = new Date();
  const currentYear = now.getUTCMonth() >= 7 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  const current = stats.seasons.filter((s) => s.season === currentYear);
  const priorPrimary = stats.seasons.filter((s) => s.season !== currentYear && s.category === primary);
  const pool = current.length
    ? [...current, ...priorPrimary]
    : stats.seasons.filter((s) => s.category === primary).length
      ? stats.seasons.filter((s) => s.category === primary)
      : stats.seasons;
  return pool.slice().sort((a, b) => {
    if (b.season !== a.season) return b.season - a.season;
    return CATEGORY_ORDER.indexOf(String(a.category)) - CATEGORY_ORDER.indexOf(String(b.category));
  });
}

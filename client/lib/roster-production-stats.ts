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
  ast: 'AST',
  tfl: 'TFL',
  qh: 'QH',
  ff: 'FF',
  pd: 'PD',
  fr: 'FR',
  xpa: 'XPA',
  in20: 'IN20',
  tb: 'TB',
  kr: 'KR',
  krYds: 'KR YDS',
  pr: 'PR',
  prYds: 'PR YDS',
};

/** Every box column, in reading order. Passing CMP/ATT is formatted separately. */
const GAME_STAT_KEYS: Record<string, string[]> = {
  passing: ['yds', 'td', 'int', 'lng', 'avg'],
  rushing: ['car', 'yds', 'td', 'lng', 'avg'],
  receiving: ['rec', 'yds', 'td', 'lng', 'avg'],
  defense: ['tot', 'solo', 'ast', 'tfl', 'sack', 'qh', 'int', 'pd', 'ff', 'fr'],
  kicking: ['fgm', 'fga', 'lng', 'xpm', 'xpa', 'pts'],
  punting: ['punts', 'yds', 'avg', 'lng', 'in20', 'tb'],
  returning: ['kr', 'krYds', 'pr', 'prYds'],
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
  const stats = game.stats || {};
  const parts: string[] = [];
  if (cat === 'passing') {
    const combo = formatCmpAtt(stats);
    if (combo) parts.push(combo);
  }
  const ordered = GAME_STAT_KEYS[cat] || Object.keys(stats);
  const seen = new Set<string>(cat === 'passing' ? ['cmp', 'att'] : []);
  for (const key of ordered) {
    seen.add(key);
    if (stats[key] == null) continue;
    parts.push(`${LABEL[key] || key.toUpperCase()} ${formatStatValue(key, stats[key])}`);
  }
  for (const key of Object.keys(stats)) {
    if (seen.has(key) || stats[key] == null) continue;
    parts.push(`${LABEL[key] || key.toUpperCase()} ${formatStatValue(key, stats[key])}`);
  }
  return parts.join(' · ') || '—';
}

export function categoryLabel(category?: string | null): string {
  const cat = String(category || '').trim();
  if (!cat) return '';
  return cat.replace(/^./, (c) => c.toUpperCase());
}

function isPlayedGame(game: ProductionGameLine): boolean {
  const week = Number(game?.week);
  return Number.isFinite(week) && week > 0 && !/^opponent$/i.test(String(game?.opponent || ''));
}

export function groupProductionGames(games: ProductionGameLine[] | null | undefined): GroupedProductionGame[] {
  const rows = (Array.isArray(games) ? games : []).filter(isPlayedGame);
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

export type GameStatPlayer = {
  slug?: string;
  name: string;
  position?: string | null;
  productionStats?: ProductionStats | null;
};

export type GameStatRow = {
  slug?: string;
  name: string;
  position: string;
  line: string;
};

export type GameStatCategoryBlock = {
  category: string;
  label: string;
  rows: GameStatRow[];
};

export type GameStatBoard = {
  key: string;
  season: number;
  week: number | null;
  date: string | null;
  opponent: string;
  homeAway: ProductionGameLine['homeAway'];
  headline: string;
  chip: string;
  categories: GameStatCategoryBlock[];
};

function gameBucketKey(game: ProductionGameLine): string {
  return `${game.season}|${game.week ?? ''}|${game.opponent}|${game.date ?? ''}`;
}

function categorySortValue(category: string, stats: Record<string, number>): number {
  if (category === 'defense') return Number(stats.tot ?? stats.solo ?? 0);
  if (category === 'kicking') return Number(stats.pts ?? stats.fgm ?? 0);
  if (category === 'punting') return Number(stats.punts ?? 0);
  if (category === 'returning') return Number(stats.krYds ?? 0) + Number(stats.prYds ?? 0);
  return Number(stats.yds ?? 0);
}

/** One board per game. Every roster player who recorded a line is listed with the full box. */
export function buildGameStatBoards(players: GameStatPlayer[] | null | undefined): GameStatBoard[] {
  const buckets = new Map<
    string,
    {
      sample: ProductionGameLine;
      byCategory: Map<string, { row: GameStatRow; sort: number }[]>;
    }
  >();

  for (const player of players || []) {
    const games = player.productionStats?.recentGames;
    if (!Array.isArray(games)) continue;
    for (const game of games) {
      if (!isPlayedGame(game)) continue;
      const line = formatGameStatLine(game);
      if (!line || line === '—') continue;
      const key = gameBucketKey(game);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = { sample: game, byCategory: new Map() };
        buckets.set(key, bucket);
      }
      const category = String(game.category || 'stats');
      const rows = bucket.byCategory.get(category) || [];
      rows.push({
        sort: categorySortValue(category, game.stats || {}),
        row: {
          slug: player.slug,
          name: player.name,
          position: String(player.position || '').toUpperCase(),
          line,
        },
      });
      bucket.byCategory.set(category, rows);
    }
  }

  const boards = [...buckets.values()].map((bucket) => {
    const categories = [...bucket.byCategory.entries()]
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0])
      )
      .map(([category, rows]) => ({
        category,
        label: categoryLabel(category),
        rows: rows
          .slice()
          .sort((a, b) => b.sort - a.sort || a.row.name.localeCompare(b.row.name))
          .map((entry) => entry.row),
      }))
      .filter((block) => block.rows.length > 0);
    const sample = bucket.sample;
    const week = sample.week ?? null;
    return {
      key: gameBucketKey(sample),
      season: sample.season,
      week,
      date: sample.date ?? null,
      opponent: sample.opponent,
      homeAway: sample.homeAway ?? null,
      headline: formatRecentGameHeadline(sample),
      chip: week != null ? `W${week}` : 'Game',
      categories,
    };
  });

  const ordered = boards.sort((a, b) => {
    if (b.season !== a.season) return b.season - a.season;
    const weekA = a.week ?? 0;
    const weekB = b.week ?? 0;
    if (weekB !== weekA) return weekB - weekA;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
  const weekCounts = new Map<string, number>();
  for (const board of ordered) {
    const id = String(board.week ?? '');
    weekCounts.set(id, (weekCounts.get(id) || 0) + 1);
  }
  for (const board of ordered) {
    if ((weekCounts.get(String(board.week ?? '')) || 0) > 1 && board.week != null) {
      board.chip = `${board.season} W${board.week}`;
    }
  }
  return ordered;
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

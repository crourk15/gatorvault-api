/** Game Week enriched bundles — merges SCHEDULE_GAMES with intel widgets. */
import { SCHEDULE_GAMES, type ScheduleGame } from './schedule-data';

export { SCHEDULE_GAMES };

export type GameKeyIntel = {
  id: string;
  side: 'front' | 'back';
  title: string;
  body: string;
};

export type SwingPlayerIntel = {
  name: string;
  position: string;
  role: string;
  impact: number;
  trend: 'up' | 'down' | 'flat';
  slug: string;
};

export type RadarAxis = {
  label: string;
  uf: number;
  opp: number;
};

export type DepthChartPlayer = {
  name: string;
  slug: string;
  snapPct: number;
  isStarter: boolean;
  trend: 'up' | 'down' | 'flat';
};

export type DepthChartGroup = {
  position: string;
  players: DepthChartPlayer[];
};

export type PredictionIntel = {
  scoreLine: string;
  spread: string;
  total: string;
  expertPicks: { source: string; pick: string }[];
  fanUfPct: number;
  confidence: number;
  movement: 'up' | 'down' | 'flat';
  modelPick: string;
};

export type ScoutingReportIntel = {
  offense: string[];
  defense: string[];
  specialTeams: string[];
  matchupSummary: string;
};

export type GameWeekBundle = {
  game: ScheduleGame;
  keys: GameKeyIntel[];
  swingPlayers: SwingPlayerIntel[];
  filmNotes: string[];
  radar: RadarAxis[];
  depthChart: DepthChartGroup[];
  scouting: ScoutingReportIntel;
  prediction: PredictionIntel;
  weather?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'rivalry';
};

const SLUG_ALIASES: Record<string, string> = {
  'jaden-baugh': 'jadan-baugh',
  'jeremiah-mccloud': 'jeramiah-mccloud',
};

/** UF roster Vault grades — used when official photo is unavailable. */
const ROSTER_VAULT_GRADES: Record<string, number> = {
  'tramell-jones-jr': 84,
  'aaron-philo': 86,
  'jaden-baugh': 88,
  'jadan-baugh': 88,
  'eric-singleton-jr': 87,
  'jayden-woods': 90,
  'cormani-mcclain': 86,
  'myles-graham': 88,
  'dijon-johnson': 84,
  'lacota-dippre': 85,
  'jaden-robinson': 83,
  'dallas-wilson': 84,
  'emeka-ugorji': 82,
  'knijeah-harris': 81,
  'brendan-bett': 83,
  'jeramiah-mccloud': 82,
};

export function vaultGradeForSlug(slug: string): number | undefined {
  const key = SLUG_ALIASES[slug] ?? slug;
  return ROSTER_VAULT_GRADES[key];
}

/** Official UF roster photos only — never SVG initials placeholders. */
export function rosterPhotoCandidates(slug: string): string[] {
  const key = SLUG_ALIASES[slug] ?? slug;
  const enc = encodeURIComponent(key);
  return [`/headshots/${enc}.jpg`, `/headshots/${enc}.png`];
}

/** @deprecated Use rosterPhotoCandidates + SwingPlayerAvatar */
export function rosterHeadshotCandidates(slug: string): string[] {
  return rosterPhotoCandidates(slug);
}

/** @deprecated Use rosterPhotoCandidates + SwingPlayerAvatar */
export function headshotUrl(slug: string): string {
  return rosterPhotoCandidates(slug)[0];
}

export function daysUntilKickoff(dateStr: string): number {
  const match = dateStr.match(/(\w+) (\d+), (\d{4})/);
  if (!match) return 0;
  const kick = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  return Math.max(0, Math.ceil((kick.getTime() - Date.now()) / 86400000));
}

export function isHomeGame(game: ScheduleGame): boolean {
  return game.label.includes(' vs ');
}

function difficultyFromPct(ufPct: number, gameId: string): GameWeekBundle['difficulty'] {
  if (gameId === 'fsu' || gameId === 'uga') return 'rivalry';
  if (ufPct >= 70) return 'easy';
  if (ufPct >= 50) return 'medium';
  return 'hard';
}

/** Optional sportsbook overlay — never invent Vegas from win% / score sum. */
export type GameWeekBettingLine = {
  spreadLine?: string | null;
  total?: number | string | null;
};

function formatSpreadLine(line: GameWeekBettingLine | null | undefined): string | null {
  const raw = String(line?.spreadLine || '').trim();
  return raw || null;
}

function formatTotalLine(line: GameWeekBettingLine | null | undefined): string | null {
  if (line?.total == null || line.total === '') return null;
  if (typeof line.total === 'number' && Number.isFinite(line.total)) {
    return `O/U ${line.total}`;
  }
  const raw = String(line.total).trim();
  if (!raw) return null;
  return /^o\/?u\b/i.test(raw) ? raw : `O/U ${raw}`;
}

function buildKeys(game: ScheduleGame): GameKeyIntel[] {
  return game.keys.map((title, i) => ({
    id: `key-${i}`,
    side: i % 2 === 0 ? 'front' : 'back',
    title,
    body: game.howUFWins?.[i] ?? game.opponentTendencies?.[i] ?? `Staff emphasis: ${title.toLowerCase()}.`,
  }));
}

function buildSwing(game: ScheduleGame): SwingPlayerIntel[] {
  const posMap: Record<string, string> = {
    'Philo / Jones Jr.': 'QB',
    'Jones Jr. / Philo': 'QB',
    'Aaron Philo': 'QB',
    'Jayden Woods': 'JACK',
    'Eric Singleton Jr.': 'WR',
    'Singleton Jr.': 'WR',
    'Jaden Baugh': 'RB',
    'Jadan Baugh': 'RB',
    'Cormani McClain': 'CB',
    'Myles Graham': 'LB',
    'QB1': 'QB',
    DL: 'DL',
    OL: 'OL',
    STAR: 'STAR',
    'Run game': 'RB',
    'WR room': 'WR',
    'Backup units': 'DEPTH',
    'Edge defenders': 'EDGE',
    Secondary: 'DB',
  };
  const slugMap: Record<string, string> = {
    'Philo / Jones Jr.': 'aaron-philo',
    'Jones Jr. / Philo': 'aaron-philo',
    'Aaron Philo': 'aaron-philo',
    'Jayden Woods': 'jayden-woods',
    'Eric Singleton Jr.': 'eric-singleton-jr',
    'Singleton Jr.': 'eric-singleton-jr',
    'Jaden Baugh': 'jadan-baugh',
    'Jadan Baugh': 'jadan-baugh',
    'Cormani McClain': 'cormani-mcclain',
    'Myles Graham': 'myles-graham',
    QB1: 'aaron-philo',
  };
  return game.swing.map((s, i) => ({
    name: s.name,
    position: posMap[s.name] ?? 'KEY',
    role: s.role,
    impact: Math.min(95, 72 + i * 8 + (game.ufPct > 60 ? 5 : 0)),
    trend: i === 0 ? 'up' : i === 1 ? 'up' : 'flat',
    slug: slugMap[s.name] ?? 'aaron-philo',
  }));
}

function defaultRadar(ufPct: number): RadarAxis[] {
  const oppBase = 100 - ufPct;
  return [
    { label: 'Run Game', uf: 78, opp: oppBase + 10 },
    { label: 'Pass Efficiency', uf: 72, opp: oppBase + 5 },
    { label: 'Front 7', uf: 80, opp: oppBase + 8 },
    { label: 'Secondary', uf: 74, opp: oppBase + 3 },
    { label: 'Special Teams', uf: 70, opp: 65 },
    { label: 'Coaching Edge', uf: ufPct > 55 ? 76 : 68, opp: oppBase },
  ];
}

function playerSlug(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return SLUG_ALIASES[base] ?? base;
}

/**
 * Placeholder depth order for Game Week until official weekly boards are wired.
 * `snapPct` is intentionally unused in the UI (was a synthetic formula, not real snap data).
 */
function defaultDepthChart(): DepthChartGroup[] {
  // Allow 1–3 names so ST roles (K / P / KR) can be single-player rows.
  const mk = (position: string, names: [string, string?, string?]): DepthChartGroup => ({
    position,
    players: names.filter((name): name is string => Boolean(name)).map((name, i) => ({
      name,
      slug: playerSlug(name),
      // Kept for type compat; not shown as "% snaps" (those values were placeholders).
      snapPct: i === 0 ? 100 : Math.max(0, 40 - i * 10),
      isStarter: i === 0,
      trend: i === 0 ? 'up' : 'flat',
    })),
  });
  return [
    mk('QB', ['Aaron Philo', 'Tramell Jones Jr.', 'Will Griffin']),
    mk('RB', ['Jaden Baugh', 'Duke Clark']),
    mk('WR', ['Eric Singleton Jr.', 'Dallas Wilson', 'Vernell Brown III']),
    mk('TE', ['Lacota Dippre', 'Amir Jackson']),
    mk('OL', ['Emeka Ugorji', 'Knijeah Harris', 'Harrison Moore']),
    mk('DL', ['Jeremiah McCloud', 'Brendan Bett', 'LJ McCray']),
    mk('LB', ['Jayden Woods', 'Myles Graham', 'Jaden Robinson']),
    mk('DB', ['Cormani McClain', 'Dijon Johnson', 'Kanye Clark']),
    // Special teams by role — do not stack K/P/KR in one "ST" column
    // (that made Vernell look like 3-deep under the kicker).
    mk('K', ['Patrick Durkin']),
    mk('P', ['Alec Clark']),
    mk('KR', ['Vernell Brown III']),
  ];
}

/** Fan Film Notes. Prefer dedicated bullets. Never dump the raw scout log here. */
export function buildFilmNotes(game: ScheduleGame): string[] {
  const dedicated = (game.filmNotes || [])
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  if (dedicated.length) return dedicated;
  const film = String(game.film || '').trim();
  return film ? [film] : [];
}

function buildScouting(game: ScheduleGame): ScoutingReportIntel {
  return {
    // UI: "Opponent offense" / "Opponent defense" — raw scout when present.
    offense: game.offenseScout?.length
      ? game.offenseScout
      : game.opponentTendencies?.length
        ? game.opponentTendencies
        : ['Establish run game early', 'Protect the football', 'Win early downs'],
    defense: game.defenseScout?.length
      ? game.defenseScout
      : game.defenseTendencies?.length
        ? game.defenseTendencies
        : ['Set the edge vs run', 'Communicate in tempo', 'Limit explosives'],
    specialTeams: ['Win field position', 'Clean punt coverage', 'No missed kicks'],
    matchupSummary: game.scoutingReport ?? game.film,
  };
}

function buildPrediction(
  game: ScheduleGame,
  betting?: GameWeekBettingLine | null
): PredictionIntel {
  const movement = game.ufPct >= 55 ? 'up' : game.ufPct <= 45 ? 'down' : 'flat';
  const spread = formatSpreadLine(betting) || 'Line pending';
  const total = formatTotalLine(betting) || 'O/U pending';
  const expertPicks: PredictionIntel['expertPicks'] = [
    { source: 'FutureCast', pick: game.pred },
  ];
  if (formatSpreadLine(betting)) {
    expertPicks.push({ source: 'Vegas consensus', pick: spread });
  }
  return {
    scoreLine: game.pred,
    spread,
    total,
    expertPicks,
    fanUfPct: game.ufPct,
    confidence: Math.min(92, Math.abs(game.ufPct - 50) + 40),
    movement,
    modelPick: game.pred.split('·')[0]?.trim() ?? 'UF',
  };
}

function generateBundle(
  game: ScheduleGame,
  betting?: GameWeekBettingLine | null
): GameWeekBundle {
  return {
    game,
    difficulty: difficultyFromPct(game.ufPct, game.id),
    weather: isHomeGame(game) ? '84°F · Clear · Light wind' : '78°F · Humid · SE 8 mph',
    keys: buildKeys(game),
    swingPlayers: buildSwing(game),
    filmNotes: buildFilmNotes(game),
    radar: defaultRadar(game.ufPct),
    depthChart: defaultDepthChart(),
    scouting: buildScouting(game),
    prediction: buildPrediction(game, betting),
  };
}

type BettingLinesLike = {
  nextGame?: {
    id?: string;
    opponent?: string;
    game?: string;
    spread?: { line?: string; uf?: number } | string;
    total?: number | string;
  };
  schedule?: Array<{
    id?: string;
    opponent?: string;
    game?: string;
    spread?: { line?: string; uf?: number } | string;
    total?: number | string;
  }>;
};

function opponentMatchTokens(game: ScheduleGame): string[] {
  const tokens = new Set<string>();
  const id = String(game.id || '').toLowerCase().trim();
  if (id) tokens.add(id);
  const opp = String(game.opp || '').toLowerCase();
  if (/florida\s*atlantic|fau|\bowls\b/.test(opp) || id === 'fau') tokens.add('fau');
  if (/florida\s*state|\bseminoles\b|\bfsu\b/.test(opp) || id === 'fsu') tokens.add('fsu');
  if (/\bgeorgia\b|\bbulldogs\b|\buga\b/.test(opp) || id === 'uga') tokens.add('uga');
  for (const part of opp.split(/[\s/]+/)) {
    const t = part.replace(/[^a-z0-9]/g, '');
    if (t && !/^(vs|at|the|owls|gators|florida|state|atlantic)$/.test(t)) tokens.add(t);
  }
  return [...tokens];
}

function rowMatchesGame(
  row: { id?: string; opponent?: string; game?: string },
  tokens: string[]
): boolean {
  const hay = `${row.id || ''} ${row.opponent || ''} ${row.game || ''}`.toLowerCase();
  return tokens.some((t) => t.length >= 2 && hay.includes(t));
}

function spreadToLine(spread: { line?: string; uf?: number } | string | undefined): string | null {
  if (spread == null) return null;
  if (typeof spread === 'string') return spread.trim() || null;
  if (spread.line) return String(spread.line).trim() || null;
  if (typeof spread.uf === 'number' && Number.isFinite(spread.uf)) {
    const sign = spread.uf > 0 ? '+' : '';
    return `UF ${sign}${spread.uf}`;
  }
  return null;
}

/**
 * Match schedule row → betting/lines nextGame or schedule entry by opponent token.
 */
export function bettingLineForScheduleGame(
  game: ScheduleGame,
  lines: BettingLinesLike | null | undefined
): GameWeekBettingLine | null {
  if (!lines) return null;
  const tokens = opponentMatchTokens(game);
  const pool = [...(lines.nextGame ? [lines.nextGame] : []), ...(lines.schedule || [])];
  const hit = pool.find((row) => rowMatchesGame(row, tokens));
  if (!hit) return null;
  return { spreadLine: spreadToLine(hit.spread), total: hit.total ?? null };
}

/**
 * Build Game Week intel from a schedule row (live API or seed).
 * Prefer `games` from `fetchScheduleGames` so weekly film updates need no Codemagic.
 * Pass `betting` from `/api/betting/lines` so Vegas consensus is not invented.
 */
export function getGameWeekBundle(
  gameId: string,
  games: ScheduleGame[] = SCHEDULE_GAMES,
  betting?: GameWeekBettingLine | null
): GameWeekBundle {
  const pool = games.length ? games : SCHEDULE_GAMES;
  const game = pool.find((g) => g.id === gameId) ?? SCHEDULE_GAMES.find((g) => g.id === gameId) ?? SCHEDULE_GAMES[0];
  return generateBundle(game, betting);
}


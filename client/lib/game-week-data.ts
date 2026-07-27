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

function parseSpread(pred: string, ufPct: number): string {
  if (ufPct >= 60) return 'UF -14.5';
  if (ufPct >= 50) return 'UF -3.5';
  if (ufPct >= 45) return 'PK';
  return 'UF +3.5';
}

function parseTotal(pred: string): string {
  const nums = pred.match(/\d+/g);
  if (!nums || nums.length < 2) return 'O/U 52.5';
  const sum = Number(nums[0]) + Number(nums[1]);
  return `O/U ${sum}.5`;
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
    mk('QB', ['Aaron Philo', 'Tramell Jones Jr.', 'Aidan Warner']),
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

function buildScouting(game: ScheduleGame): ScoutingReportIntel {
  return {
    offense: game.howUFWins?.length
      ? game.howUFWins
      : ['Establish run game early', 'Protect the football', 'Win early downs'],
    defense: game.opponentTendencies?.length
      ? game.opponentTendencies
      : ['Set the edge vs run', 'Communicate in tempo', 'Limit explosives'],
    specialTeams: ['Win field position', 'Clean punt coverage', 'No missed kicks'],
    matchupSummary: game.scoutingReport ?? game.film,
  };
}

function buildPrediction(game: ScheduleGame): PredictionIntel {
  const movement = game.ufPct >= 55 ? 'up' : game.ufPct <= 45 ? 'down' : 'flat';
  return {
    scoreLine: game.pred,
    spread: parseSpread(game.pred, game.ufPct),
    total: parseTotal(game.pred),
    expertPicks: [
      { source: 'FutureCast', pick: game.pred },
      { source: 'Vegas consensus', pick: parseSpread(game.pred, game.ufPct) },
    ],
    fanUfPct: game.ufPct,
    confidence: Math.min(92, Math.abs(game.ufPct - 50) + 40),
    movement,
    modelPick: game.pred.split('·')[0]?.trim() ?? 'UF',
  };
}

const FAU_BUNDLE: GameWeekBundle = {
  game: SCHEDULE_GAMES[0],
  difficulty: 'easy',
  weather: '82°F · Partly cloudy · SW 6 mph',
  keys: [
    {
      id: 'fau-k1',
      side: 'front',
      title: 'Establish run with Baugh early',
      body: 'FAU loads the box on early downs — Baugh sets physical tone and opens RPO windows for Philo.',
    },
    {
      id: 'fau-k2',
      side: 'back',
      title: 'QB1: no turnovers in debut',
      body: 'Philo’s job to lose into camp. Owls will test STAR communication with tempo RPO — protect the football and take what the defense gives.',
    },
    {
      id: 'fau-k3',
      side: 'front',
      title: 'Defense sets physical tone',
      body: 'White front must set the edge vs conflict reads. Win early downs and force long drives.',
    },
  ],
  swingPlayers: [
    {
      name: 'Aaron Philo',
      position: 'QB',
      role: 'QB1 into camp — job his to lose',
      impact: 88,
      trend: 'up',
      slug: 'aaron-philo',
    },
    {
      name: 'Jayden Woods',
      position: 'JACK',
      role: 'JACK sets the edge',
      impact: 91,
      trend: 'up',
      slug: 'jayden-woods',
    },
    {
      name: 'Eric Singleton Jr.',
      position: 'WR',
      role: 'Vertical stress vs soft coverage',
      impact: 84,
      trend: 'flat',
      slug: 'eric-singleton-jr',
    },
  ],
  filmNotes: [
    'FAU runs spread RPO at tempo — tests STAR communication.',
    'The 3-3-5 is built to neutralize this attack.',
    'Limited vertical threat — win early downs and field position.',
    'Owls will probe conflict reads on the edge; Woods must set the tone.',
  ],
  radar: [
    { label: 'Run Game', uf: 82, opp: 58 },
    { label: 'Pass Efficiency', uf: 78, opp: 62 },
    { label: 'Front 7', uf: 85, opp: 55 },
    { label: 'Secondary', uf: 80, opp: 60 },
    { label: 'Special Teams', uf: 74, opp: 68 },
    { label: 'Coaching Edge', uf: 79, opp: 65 },
  ],
  depthChart: defaultDepthChart(),
  scouting: {
    offense: [
      'Faulkner establishes rhythm RPO without negative plays',
      'Baugh sets physical tone on early downs',
      'Singleton Jr. wins one-on-ones when FAU loads the box',
    ],
    defense: [
      'White front sets edge vs conflict reads',
      'STAR communication vs tempo RPO',
      'Control explosives and force long drives',
    ],
    specialTeams: ['Win field position battle', 'Clean punt coverage', 'No missed kicks in debut'],
    matchupSummary:
      "FAU spreads the field and operates quickly. UF's odd front and STAR fit are built for this opener — control explosives and force long drives.",
  },
  prediction: {
    scoreLine: 'UF 38 · FAU 10',
    spread: 'UF -28.5',
    total: 'O/U 48.5',
    expertPicks: [
      { source: 'FutureCast', pick: 'UF 38 · FAU 10' },
      { source: 'Vegas consensus', pick: 'UF -27.5' },
      { source: 'ESPN FPI', pick: 'UF 94%' },
    ],
    fanUfPct: 94,
    confidence: 88,
    movement: 'up',
    modelPick: 'UF 38',
  },
};

function generateBundle(gameId: string): GameWeekBundle {
  if (gameId === 'fau') return FAU_BUNDLE;
  const game = SCHEDULE_GAMES.find((g) => g.id === gameId) ?? SCHEDULE_GAMES[0];
  return {
    game,
    difficulty: difficultyFromPct(game.ufPct, game.id),
    weather: isHomeGame(game) ? '84°F · Clear · Light wind' : '78°F · Humid · SE 8 mph',
    keys: buildKeys(game),
    swingPlayers: buildSwing(game),
    filmNotes: [game.film, ...(game.opponentTendencies ?? [])],
    radar: defaultRadar(game.ufPct),
    depthChart: defaultDepthChart(),
    scouting: buildScouting(game),
    prediction: buildPrediction(game),
  };
}

export function getGameWeekBundle(gameId: string): GameWeekBundle {
  return generateBundle(gameId);
}


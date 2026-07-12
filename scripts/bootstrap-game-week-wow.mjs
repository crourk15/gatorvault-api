import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const files = new Map();

function add(rel, content) {
  files.set(path.join(ROOT, rel), content);
}

add('client/lib/team-logos.ts', `/** ESPN CDN team logos for Game Week matchup widgets. */

export const UF_ESPN_TEAM_ID = 57;

export const OPPONENT_ESPN_IDS: Record<string, number> = {
  fau: 2226,
  charlotte: 2429,
  auburn: 2,
  olemiss: 145,
  missouri: 142,
  lsu: 99,
  texas: 251,
  uga: 61,
  oklahoma: 201,
  kentucky: 96,
  vandy: 238,
  scar: 2579,
  fsu: 52,
};

export function espnTeamLogoUrl(teamId: number): string {
  return \`https://a.espncdn.com/i/teamlogos/ncaa/500/\${teamId}.png\`;
}

export function ufLogoUrl(): string {
  return espnTeamLogoUrl(UF_ESPN_TEAM_ID);
}

export function opponentLogoUrl(gameId: string): string {
  const id = OPPONENT_ESPN_IDS[gameId];
  if (!id) return espnTeamLogoUrl(UF_ESPN_TEAM_ID);
  return espnTeamLogoUrl(id);
}
`);

add('client/lib/game-week-data.ts', `/** Game Week enriched bundles — merges SCHEDULE_GAMES with intel widgets. */
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

const PLAYER_HEADSHOT_IDS: Record<string, number> = {
  'tramell-jones-jr': 4870606,
  'aaron-philo': 4870607,
  'jaden-baugh': 4685411,
  'eric-singleton-jr': 4431586,
  'jayden-woods': 4870610,
  'cormani-mcclain': 4685415,
  'myles-graham': 4685420,
  'dijon-johnson': 4431590,
  'lacota-dippre': 4685418,
};

export function headshotUrl(slug: string): string {
  const id = PLAYER_HEADSHOT_IDS[slug] ?? 0;
  if (!id) {
    return 'https://a.espncdn.com/i/headshots/college-football/players/full/0.png';
  }
  return \`https://a.espncdn.com/i/headshots/college-football/players/full/\${id}.png\`;
}

export function daysUntilKickoff(dateStr: string): number {
  const match = dateStr.match(/(\\w+) (\\d+), (\\d{4})/);
  if (!match) return 0;
  const kick = new Date(\`\${match[1]} \${match[2]}, \${match[3]}\`);
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
  const nums = pred.match(/\\d+/g);
  if (!nums || nums.length < 2) return 'O/U 52.5';
  const sum = Number(nums[0]) + Number(nums[1]);
  return \`O/U \${sum}.5\`;
}

function buildKeys(game: ScheduleGame): GameKeyIntel[] {
  return game.keys.map((title, i) => ({
    id: \`key-\${i}\`,
    side: i % 2 === 0 ? 'front' : 'back',
    title,
    body: game.howUFWins?.[i] ?? game.opponentTendencies?.[i] ?? \`Staff emphasis: \${title.toLowerCase()}.\`,
  }));
}

function buildSwing(game: ScheduleGame): SwingPlayerIntel[] {
  const posMap: Record<string, string> = {
    'Jones Jr. / Philo': 'QB',
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
    'Jones Jr. / Philo': 'tramell-jones-jr',
    'Jayden Woods': 'jayden-woods',
    'Eric Singleton Jr.': 'eric-singleton-jr',
    'Singleton Jr.': 'eric-singleton-jr',
    'Jaden Baugh': 'jaden-baugh',
    'Jadan Baugh': 'jaden-baugh',
    'Cormani McClain': 'cormani-mcclain',
    'Myles Graham': 'myles-graham',
    QB1: 'tramell-jones-jr',
  };
  return game.swing.map((s, i) => ({
    name: s.name,
    position: posMap[s.name] ?? 'KEY',
    role: s.role,
    impact: Math.min(95, 72 + i * 8 + (game.ufPct > 60 ? 5 : 0)),
    trend: i === 0 ? 'up' : i === 1 ? 'flat' : 'down',
    slug: slugMap[s.name] ?? 'tramell-jones-jr',
  }));
}

function defaultRadar(ufPct: number): RadarAxis[] {
  const oppBase = 100 - ufPct;
  return [
    { label: 'Run Game', uf: 78, opp: oppBase + 10 },
    { label: 'Pass Eff', uf: 72, opp: oppBase + 5 },
    { label: 'Front 7', uf: 80, opp: oppBase + 8 },
    { label: 'Secondary', uf: 74, opp: oppBase + 3 },
    { label: 'Special Teams', uf: 70, opp: 65 },
    { label: 'Coaching Edge', uf: ufPct > 55 ? 76 : 68, opp: oppBase },
  ];
}

function defaultDepthChart(): DepthChartGroup[] {
  const mk = (position: string, names: [string, string, string?]): DepthChartGroup => ({
    position,
    players: names.filter(Boolean).map((name, i) => ({
      name: name!,
      slug: name!.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      snapPct: i === 0 ? 78 - i * 12 : 42 - i * 8,
      isStarter: i === 0,
      trend: i === 0 ? 'up' : 'flat',
    })),
  });
  return [
    mk('QB', ['Tramell Jones Jr.', 'Aaron Philo', 'Aidan Warner']),
    mk('RB', ['Jaden Baugh', 'Duke Clark']),
    mk('WR', ['Eric Singleton Jr.', 'Dallas Wilson', 'Vernell Brown III']),
    mk('TE', ['Lacota Dippre', 'Amir Jackson']),
    mk('OL', ['Emeka Ugorji', 'Knijeah Harris', 'Harrison Moore']),
    mk('DL', ['Jeremiah McCloud', 'Brendan Bett', 'LJ McCray']),
    mk('LB', ['Jayden Woods', 'Myles Graham', 'Jaden Robinson']),
    mk('DB', ['Cormani McClain', 'Dijon Johnson', 'Kanye Clark']),
    mk('ST', ['Patrick Durkin', 'Alec Clark', 'Vernell Brown III']),
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
      body: 'FAU loads the box on early downs — Baugh sets physical tone and opens RPO windows for Jones Jr.',
    },
    {
      id: 'fau-k2',
      side: 'back',
      title: 'QB1: no turnovers in debut',
      body: 'Owls will test STAR communication with tempo RPO. Protect the football and take what the defense gives.',
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
      name: 'Tramell Jones Jr.',
      position: 'QB',
      role: 'Efficiency matters in debut',
      impact: 88,
      trend: 'up',
      slug: 'tramell-jones-jr',
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
    { label: 'Pass Eff', uf: 78, opp: 62 },
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
`);

// CSS file - large
add('client/lib/game-week-wow.css', `/* Game Week WOW theme — dark navy command center */
.gv-gw-wow-root {
  --gv-gw-bg: #0a0f1c;
  --gv-gw-card: #111827;
  --gv-gw-orange: #fa4616;
  --gv-gw-blue: #0021a5;
  --gv-gw-text: #f3f4f6;
  --gv-gw-muted: #9ca3af;
  background: var(--gv-gw-bg);
  color: var(--gv-gw-text);
  border-radius: 16px;
  padding: 1rem;
}

.gv-gw-wow-section {
  margin-bottom: 1.25rem;
}

.gv-gw-wow-section__title {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--gv-gw-orange);
  margin: 0 0 0.5rem;
}

/* Matchup hero */
.gv-gw-matchup-hero {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  background: linear-gradient(135deg, #111827 0%, #0a0f1c 100%);
  border: 1px solid rgba(250, 70, 22, 0.25);
  border-radius: 16px;
  padding: 1.25rem;
  animation: gv-gw-slide-in 0.6s ease-out;
}

.gv-gw-matchup-hero__logo {
  width: 72px;
  height: 72px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.4));
}

.gv-gw-matchup-hero__center {
  text-align: center;
}

.gv-gw-matchup-hero__title {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0.35rem 0;
}

.gv-gw-matchup-hero__meta {
  font-size: 0.85rem;
  color: var(--gv-gw-muted);
  margin: 0;
}

.gv-gw-matchup-hero__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  justify-content: center;
  margin-top: 0.5rem;
}

.gv-gw-matchup-hero__badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(250, 70, 22, 0.15);
  color: var(--gv-gw-orange);
  border: 1px solid rgba(250, 70, 22, 0.35);
}

/* Countdown */
.gv-gw-countdown {
  text-align: center;
  padding: 1rem;
  background: var(--gv-gw-card);
  border-radius: 12px;
  animation: gv-gw-fade-in 0.5s ease;
}

.gv-gw-countdown__num {
  display: block;
  font-size: 2.5rem;
  font-weight: 900;
  color: var(--gv-gw-orange);
  animation: gv-gw-pulse 2s ease-in-out infinite;
}

.gv-gw-countdown__label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--gv-gw-muted);
}

/* Season timeline */
.gv-gw-timeline {
  display: flex;
  gap: 0.65rem;
  overflow-x: auto;
  padding: 0.5rem 0 1rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;
}

.gv-gw-timeline__card {
  flex: 0 0 140px;
  scroll-snap-align: start;
  background: var(--gv-gw-card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 0.75rem;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
  text-align: left;
}

.gv-gw-timeline__card:hover {
  transform: translateY(-2px);
  border-color: rgba(250, 70, 22, 0.4);
}

.gv-gw-timeline__card.is-active {
  border-color: var(--gv-gw-orange);
  box-shadow: 0 0 0 1px var(--gv-gw-orange);
}

.gv-gw-timeline__logo {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.gv-gw-timeline__label {
  font-size: 0.72rem;
  font-weight: 700;
  margin: 0.35rem 0 0;
}

.gv-gw-timeline__ha {
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  display: inline-block;
  margin-top: 0.25rem;
}

.gv-gw-timeline__ha--home {
  background: rgba(0, 33, 165, 0.3);
  color: #93c5fd;
}

.gv-gw-timeline__ha--away {
  background: rgba(250, 70, 22, 0.2);
  color: var(--gv-gw-orange);
}

.gv-gw-timeline__diff--easy { border-left: 3px solid #22c55e; }
.gv-gw-timeline__diff--medium { border-left: 3px solid #eab308; }
.gv-gw-timeline__diff--hard { border-left: 3px solid #ef4444; }
.gv-gw-timeline__diff--rivalry { border-left: 3px solid var(--gv-gw-orange); }

/* Win probability gauge */
.gv-gw-wp-gauge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  background: var(--gv-gw-card);
  border-radius: 12px;
  animation: gv-gw-fade-in 0.6s ease;
}

.gv-gw-wp-gauge__svg {
  width: 140px;
  height: 140px;
}

.gv-gw-wp-gauge__pct {
  font-size: 1.75rem;
  font-weight: 900;
  fill: var(--gv-gw-blue);
}

.gv-gw-wp-gauge__movement {
  font-size: 0.75rem;
  font-weight: 700;
  margin-top: 0.35rem;
}

.gv-gw-wp-gauge__movement--up { color: #22c55e; }
.gv-gw-wp-gauge__movement--down { color: #ef4444; }
.gv-gw-wp-gauge__movement--flat { color: var(--gv-gw-muted); }

.gv-gw-wp-gauge__confidence {
  font-size: 0.65rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(0, 33, 165, 0.25);
  color: #93c5fd;
  margin-top: 0.35rem;
}

/* Radar chart */
.gv-gw-radar {
  background: var(--gv-gw-card);
  border-radius: 12px;
  padding: 1rem;
  animation: gv-gw-fade-in 0.7s ease;
}

.gv-gw-radar__legend {
  display: flex;
  gap: 1rem;
  justify-content: center;
  font-size: 0.7rem;
  margin-top: 0.5rem;
}

.gv-gw-radar__legend-uf { color: #93c5fd; }
.gv-gw-radar__legend-opp { color: var(--gv-gw-orange); }

/* Flip cards */
.gv-gw-flip-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.gv-gw-flip-card {
  perspective: 800px;
  height: 140px;
}

.gv-gw-flip-card__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.5s;
  transform-style: preserve-3d;
}

.gv-gw-flip-card:hover .gv-gw-flip-card__inner {
  transform: rotateY(180deg);
}

.gv-gw-flip-card__face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 12px;
  padding: 1rem;
  background: var(--gv-gw-card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.gv-gw-flip-card__face--back {
  transform: rotateY(180deg);
  font-size: 0.85rem;
  color: var(--gv-gw-muted);
}

.gv-gw-flip-card__title {
  font-weight: 800;
  font-size: 0.9rem;
  margin: 0;
}

/* Swing players */
.gv-gw-swing-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.gv-gw-swing-card {
  background: var(--gv-gw-card);
  border-radius: 12px;
  padding: 0.85rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  animation: gv-gw-slide-in 0.5s ease;
}

.gv-gw-swing-card__headshot {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--gv-gw-blue);
}

.gv-gw-swing-card__pos {
  font-size: 0.6rem;
  font-weight: 800;
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
  background: var(--gv-gw-orange);
  color: #fff;
}

.gv-gw-swing-card__bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-top: 0.35rem;
  overflow: hidden;
}

.gv-gw-swing-card__bar-fill {
  height: 100%;
  background: var(--gv-gw-blue);
  border-radius: 2px;
}

.gv-gw-swing-card__trend--up { color: #22c55e; }
.gv-gw-swing-card__trend--down { color: #ef4444; }
.gv-gw-swing-card__trend--flat { color: var(--gv-gw-muted); }

/* Film notes */
.gv-gw-film-panel {
  background: var(--gv-gw-card);
  border-radius: 12px;
  padding: 1rem;
}

.gv-gw-film-panel__list {
  margin: 0;
  padding-left: 1.1rem;
}

.gv-gw-film-panel__link {
  display: inline-block;
  margin-top: 0.75rem;
  color: var(--gv-gw-orange);
  font-weight: 700;
  font-size: 0.85rem;
  text-decoration: none;
}

.gv-gw-film-panel__link:hover {
  text-decoration: underline;
}

/* Depth chart grid */
.gv-gw-depth-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.65rem;
}

.gv-gw-depth-col {
  background: var(--gv-gw-card);
  border-radius: 10px;
  padding: 0.65rem;
}

.gv-gw-depth-col__pos {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--gv-gw-orange);
  margin-bottom: 0.5rem;
}

.gv-gw-depth-player {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
  font-size: 0.78rem;
}

.gv-gw-depth-player__headshot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.gv-gw-depth-player__starter {
  font-size: 0.55rem;
  font-weight: 800;
  color: var(--gv-gw-orange);
}

/* Scouting report */
.gv-gw-scout-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.gv-gw-scout-card {
  background: var(--gv-gw-card);
  border-radius: 12px;
  padding: 0.85rem;
}

.gv-gw-scout-card__title {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--gv-gw-orange);
  margin: 0 0 0.5rem;
}

.gv-gw-scout-summary {
  margin-top: 0.75rem;
  padding: 0.85rem;
  background: rgba(0, 33, 165, 0.12);
  border-radius: 10px;
  font-size: 0.85rem;
}

/* Prediction panel */
.gv-gw-pred-panel {
  background: var(--gv-gw-card);
  border-radius: 12px;
  padding: 1rem;
  border: 1px solid rgba(250, 70, 22, 0.2);
}

.gv-gw-pred-panel__score {
  font-size: 1.5rem;
  font-weight: 900;
  color: var(--gv-gw-orange);
  margin: 0;
}

.gv-gw-pred-panel__lines {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--gv-gw-muted);
  margin: 0.5rem 0;
}

.gv-gw-pred-panel__fan-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  margin: 0.5rem 0;
}

.gv-gw-pred-panel__fan-fill {
  height: 100%;
  background: var(--gv-gw-blue);
}

.gv-gw-pred-panel__confidence-meter {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  margin-top: 0.35rem;
  overflow: hidden;
}

.gv-gw-pred-panel__confidence-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--gv-gw-blue), var(--gv-gw-orange));
}

.gv-gw-pred-panel__experts {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.8rem;
}

.gv-gw-pred-panel__experts li {
  padding: 0.25rem 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

/* Tab bar override */
.gv-gw-wow-tabs {
  margin: 1rem 0;
}

/* Animations */
@keyframes gv-gw-slide-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes gv-gw-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes gv-gw-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@media (max-width: 640px) {
  .gv-gw-matchup-hero {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .gv-gw-matchup-hero__logo {
    margin: 0 auto;
  }
}
`);

add('client/components/vault/game-week/MatchupHeroWidget.tsx', `'use client';

import React from 'react';
import { ufLogoUrl, opponentLogoUrl } from '@/lib/team-logos';
import type { GameWeekBundle } from '@/lib/game-week-data';

type Props = {
  bundle: GameWeekBundle;
};

export function MatchupHeroWidget({ bundle }: Props): React.ReactElement {
  const { game, weather } = bundle;
  return (
    <div className="gv-gw-matchup-hero" data-testid="gw-matchup-hero">
      <img
        src={ufLogoUrl()}
        alt="Florida Gators"
        className="gv-gw-matchup-hero__logo"
        width={72}
        height={72}
      />
      <div className="gv-gw-matchup-hero__center">
        <h2 className="gv-gw-matchup-hero__title">Florida vs {game.opp}</h2>
        <p className="gv-gw-matchup-hero__meta">{game.date}</p>
        <p className="gv-gw-matchup-hero__meta">{game.venue}</p>
        <div className="gv-gw-matchup-hero__badges">
          {game.tv ? <span className="gv-gw-matchup-hero__badge">{game.tv}</span> : null}
          <span className="gv-gw-matchup-hero__badge">{game.venue.split(',')[0]}</span>
          {weather ? <span className="gv-gw-matchup-hero__badge">{weather}</span> : null}
        </div>
      </div>
      <img
        src={opponentLogoUrl(game.id)}
        alt={game.opp}
        className="gv-gw-matchup-hero__logo"
        width={72}
        height={72}
      />
    </div>
  );
}
`);

add('client/components/vault/game-week/CountdownWidget.tsx', `'use client';

import React, { useMemo } from 'react';
import { daysUntilKickoff } from '@/lib/game-week-data';

type Props = {
  dateStr: string;
};

export function CountdownWidget({ dateStr }: Props): React.ReactElement {
  const days = useMemo(() => daysUntilKickoff(dateStr), [dateStr]);
  return (
    <div className="gv-gw-countdown" data-testid="gw-countdown">
      <span className="gv-gw-countdown__num">{days}</span>
      <span className="gv-gw-countdown__label">Days to kickoff</span>
    </div>
  );
}
`);

add('client/components/vault/game-week/SeasonTimeline.tsx', `'use client';

import React from 'react';
import { SCHEDULE_GAMES, isHomeGame, type GameWeekBundle } from '@/lib/game-week-data';
import { opponentLogoUrl } from '@/lib/team-logos';
import { getGameWeekBundle } from '@/lib/game-week-data';

type Props = {
  activeGameId: string;
  onSelect: (gameId: string) => void;
};

function diffClass(difficulty: GameWeekBundle['difficulty']): string {
  return \`gv-gw-timeline__diff--\${difficulty}\`;
}

export function SeasonTimeline({ activeGameId, onSelect }: Props): React.ReactElement {
  return (
    <div className="gv-gw-timeline" data-testid="gw-season-timeline">
      {SCHEDULE_GAMES.map((g) => {
        const bundle = getGameWeekBundle(g.id);
        const home = isHomeGame(g);
        return (
          <button
            key={g.id}
            type="button"
            className={\`gv-gw-timeline__card \${diffClass(bundle.difficulty)}\${activeGameId === g.id ? ' is-active' : ''}\`}
            onClick={() => onSelect(g.id)}
          >
            <img
              src={opponentLogoUrl(g.id)}
              alt=""
              className="gv-gw-timeline__logo"
              width={36}
              height={36}
            />
            <p className="gv-gw-timeline__label">{g.label}</p>
            <span className={\`gv-gw-timeline__ha gv-gw-timeline__ha--\${home ? 'home' : 'away'}\`}>
              {home ? 'HOME' : 'AWAY'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
`);

add('client/components/vault/game-week/WinProbabilityGaugeWidget.tsx', `'use client';

import React from 'react';
import type { PredictionIntel } from '@/lib/game-week-data';

type Props = {
  prediction: PredictionIntel;
};

export function WinProbabilityGaugeWidget({ prediction }: Props): React.ReactElement {
  const pct = prediction.fanUfPct;
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const movementLabel =
    prediction.movement === 'up' ? '↑ Trending UF' : prediction.movement === 'down' ? '↓ Trending Opp' : '→ Stable';

  return (
    <div className="gv-gw-wp-gauge" data-testid="gw-wp-gauge">
      <svg className="gv-gw-wp-gauge__svg" viewBox="0 0 128 128" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#0021A5"
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 64 64)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="64" y="68" textAnchor="middle" className="gv-gw-wp-gauge__pct">
          {pct}%
        </text>
      </svg>
      <span className={\`gv-gw-wp-gauge__movement gv-gw-wp-gauge__movement--\${prediction.movement}\`}>
        {movementLabel}
      </span>
      <span className="gv-gw-wp-gauge__confidence">{prediction.confidence}% confidence</span>
    </div>
  );
}
`);

add('client/components/vault/game-week/ScoutingRadarChart.tsx', `'use client';

import React from 'react';
import type { RadarAxis } from '@/lib/game-week-data';

type Props = {
  axes: RadarAxis[];
  opponentName: string;
};

const SIZE = 220;
const CENTER = SIZE / 2;
const MAX_R = 80;

function point(angleIdx: number, value: number, total: number): [number, number] {
  const angle = (Math.PI * 2 * angleIdx) / total - Math.PI / 2;
  const r = (value / 100) * MAX_R;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const [x, y] = point(i, v, values.length);
      return \`\${x},\${y}\`;
    })
    .join(' ');
}

export function ScoutingRadarChart({ axes, opponentName }: Props): React.ReactElement {
  const n = axes.length;
  const gridLevels = [25, 50, 75, 100];

  return (
    <div className="gv-gw-radar" data-testid="gw-radar-chart">
      <svg width={SIZE} height={SIZE} viewBox={\`0 0 \${SIZE} \${SIZE}\`} role="img" aria-label="Scouting radar comparison">
        {gridLevels.map((lvl) => (
          <polygon
            key={lvl}
            points={polygonPoints(Array(n).fill(lvl))}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, 100, n);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" />;
        })}
        <polygon
          points={polygonPoints(axes.map((a) => a.opp))}
          fill="rgba(250,70,22,0.2)"
          stroke="#FA4616"
          strokeWidth="2"
        />
        <polygon
          points={polygonPoints(axes.map((a) => a.uf))}
          fill="rgba(0,33,165,0.25)"
          stroke="#0021A5"
          strokeWidth="2"
        />
        {axes.map((a, i) => {
          const [x, y] = point(i, 115, n);
          return (
            <text key={a.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" fontSize="9">
              {a.label}
            </text>
          );
        })}
      </svg>
      <div className="gv-gw-radar__legend">
        <span className="gv-gw-radar__legend-uf">● UF</span>
        <span className="gv-gw-radar__legend-opp">● {opponentName.split(' ')[0]}</span>
      </div>
    </div>
  );
}
`);

add('client/components/vault/game-week/KeysToGameCards.tsx', `'use client';

import React from 'react';
import type { GameKeyIntel } from '@/lib/game-week-data';

type Props = {
  keys: GameKeyIntel[];
};

export function KeysToGameCards({ keys }: Props): React.ReactElement {
  return (
    <div className="gv-gw-flip-grid" data-testid="gw-keys-cards">
      {keys.map((k) => (
        <div key={k.id} className="gv-gw-flip-card">
          <div className="gv-gw-flip-card__inner">
            <div className="gv-gw-flip-card__face gv-gw-flip-card__face--front">
              <p className="gv-gw-flip-card__title">{k.title}</p>
            </div>
            <div className="gv-gw-flip-card__face gv-gw-flip-card__face--back">
              <p>{k.body}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
`);

add('client/components/vault/game-week/SwingPlayersCards.tsx', `'use client';

import React from 'react';
import { headshotUrl, type SwingPlayerIntel } from '@/lib/game-week-data';

type Props = {
  players: SwingPlayerIntel[];
};

function trendArrow(trend: SwingPlayerIntel['trend']): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

export function SwingPlayersCards({ players }: Props): React.ReactElement {
  return (
    <div className="gv-gw-swing-grid" data-testid="gw-swing-cards">
      {players.map((p) => (
        <div key={p.slug + p.name} className="gv-gw-swing-card">
          <img
            src={headshotUrl(p.slug)}
            alt={p.name}
            className="gv-gw-swing-card__headshot"
            width={48}
            height={48}
          />
          <div>
            <span className="gv-gw-swing-card__pos">{p.position}</span>
            <strong>{p.name}</strong>
            <p style={{ margin: '0.2rem 0', fontSize: '0.8rem', color: '#9CA3AF' }}>{p.role}</p>
            <div className="gv-gw-swing-card__bar">
              <div className="gv-gw-swing-card__bar-fill" style={{ width: \`\${p.impact}%\` }} />
            </div>
            <span className={\`gv-gw-swing-card__trend--\${p.trend}\`}>
              {trendArrow(p.trend)} Impact {p.impact}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
`);

add('client/components/vault/game-week/FilmNotesPanel.tsx', `'use client';

import React from 'react';
import type { ScheduleGame } from '@/lib/schedule-data';

type Props = {
  notes: string[];
  game: ScheduleGame;
};

export function FilmNotesPanel({ notes, game }: Props): React.ReactElement {
  const lessonHref = game.filmLessonId
    ? \`/vault/film-room/?hub=Film%20Breakdown&lesson=\${encodeURIComponent(game.filmLessonId)}\`
    : '/vault/film-room/?hub=Opponent%20Prep';

  return (
    <div className="gv-gw-film-panel" data-testid="gw-film-notes">
      <ul className="gv-gw-film-panel__list">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      <a href={lessonHref} className="gv-gw-film-panel__link">
        Opponent prep in Film Room →
      </a>
    </div>
  );
}
`);

add('client/components/vault/game-week/DepthChartGrid.tsx', `'use client';

import React from 'react';
import { headshotUrl, type DepthChartGroup } from '@/lib/game-week-data';

type Props = {
  groups: DepthChartGroup[];
};

export function DepthChartGrid({ groups }: Props): React.ReactElement {
  return (
    <div className="gv-gw-depth-grid" data-testid="gw-depth-chart">
      {groups.map((g) => (
        <div key={g.position} className="gv-gw-depth-col">
          <div className="gv-gw-depth-col__pos">{g.position}</div>
          {g.players.map((p) => (
            <div key={p.slug} className="gv-gw-depth-player">
              <img
                src={headshotUrl(p.slug)}
                alt=""
                className="gv-gw-depth-player__headshot"
                width={28}
                height={28}
              />
              <div>
                <div>
                  {p.name}
                  {p.isStarter ? <span className="gv-gw-depth-player__starter"> ★</span> : null}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>
                  {p.snapPct}% snaps {p.trend === 'up' ? '↑' : p.trend === 'down' ? '↓' : '→'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
`);

add('client/components/vault/game-week/ScoutingReportPanel.tsx', `'use client';

import React from 'react';
import type { ScoutingReportIntel } from '@/lib/game-week-data';

type Props = {
  scouting: ScoutingReportIntel;
};

export function ScoutingReportPanel({ scouting }: Props): React.ReactElement {
  return (
    <div data-testid="gw-scouting-report">
      <div className="gv-gw-scout-grid">
        <div className="gv-gw-scout-card">
          <h3 className="gv-gw-scout-card__title">Offense</h3>
          <ul>
            {scouting.offense.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="gv-gw-scout-card">
          <h3 className="gv-gw-scout-card__title">Defense</h3>
          <ul>
            {scouting.defense.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="gv-gw-scout-card">
          <h3 className="gv-gw-scout-card__title">Special Teams</h3>
          <ul>
            {scouting.specialTeams.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="gv-gw-scout-summary">{scouting.matchupSummary}</div>
    </div>
  );
}
`);

add('client/components/vault/game-week/PredictionPanel.tsx', `'use client';

import React from 'react';
import type { PredictionIntel } from '@/lib/game-week-data';

type Props = {
  prediction: PredictionIntel;
};

export function PredictionPanel({ prediction }: Props): React.ReactElement {
  return (
    <div className="gv-gw-pred-panel" data-testid="gw-prediction-panel">
      <p className="gv-gw-pred-panel__score">{prediction.scoreLine}</p>
      <div className="gv-gw-pred-panel__lines">
        <span>{prediction.spread}</span>
        <span>{prediction.total}</span>
        <span>Model: {prediction.modelPick}</span>
      </div>
      <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0.25rem' }}>Fan poll — UF win</p>
      <div className="gv-gw-pred-panel__fan-bar">
        <div className="gv-gw-pred-panel__fan-fill" style={{ width: \`\${prediction.fanUfPct}%\` }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{prediction.fanUfPct}% Gator Nation</p>
      <ul className="gv-gw-pred-panel__experts">
        {prediction.expertPicks.map((e) => (
          <li key={e.source}>
            <strong>{e.source}:</strong> {e.pick}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>Model confidence</p>
      <div className="gv-gw-pred-panel__confidence-meter">
        <div className="gv-gw-pred-panel__confidence-fill" style={{ width: \`\${prediction.confidence}%\` }} />
      </div>
    </div>
  );
}
`);

add('client/components/vault/game-week/GameWeekCommandCenter.tsx', `'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageSection, TabBar } from '@/components/brand';
import { getGameWeekBundle } from '@/lib/game-week-data';
import { MatchupHeroWidget } from './MatchupHeroWidget';
import { CountdownWidget } from './CountdownWidget';
import { SeasonTimeline } from './SeasonTimeline';
import { WinProbabilityGaugeWidget } from './WinProbabilityGaugeWidget';
import { ScoutingRadarChart } from './ScoutingRadarChart';
import { KeysToGameCards } from './KeysToGameCards';
import { SwingPlayersCards } from './SwingPlayersCards';
import { FilmNotesPanel } from './FilmNotesPanel';
import { DepthChartGrid } from './DepthChartGrid';
import { ScoutingReportPanel } from './ScoutingReportPanel';
import { PredictionPanel } from './PredictionPanel';

const TABS = [
  { id: 'intel', label: 'Intel' },
  { id: 'depth', label: 'Depth Chart' },
  { id: 'scouting', label: 'Scouting' },
  { id: 'prediction', label: 'Prediction' },
];

type Props = {
  initialGameId?: string;
  onGameChange?: (gameId: string) => void;
};

export function GameWeekCommandCenter({ initialGameId = 'fau', onGameChange }: Props): React.ReactElement {
  const [gameId, setGameId] = useState(initialGameId);
  const [tab, setTab] = useState('intel');

  useEffect(() => {
    if (initialGameId) setGameId(initialGameId);
  }, [initialGameId]);

  const bundle = useMemo(() => getGameWeekBundle(gameId), [gameId]);

  const handleGameSelect = useCallback(
    (id: string) => {
      setGameId(id);
      onGameChange?.(id);
    },
    [onGameChange]
  );

  return (
    <div className="gv-gw-wow-root" data-testid="game-week-command-center">
      <CountdownWidget dateStr={bundle.game.date} />
      <MatchupHeroWidget bundle={bundle} />
      <SeasonTimeline activeGameId={gameId} onSelect={handleGameSelect} />

      <TabBar
        options={TABS}
        active={tab}
        onChange={setTab}
        className="gv-gw-wow-tabs"
        aria-label="Game week sections"
      />

      {tab === 'intel' ? (
        <>
          <PageSection title="Win probability" subtitle="FutureCast Game Week model">
            <WinProbabilityGaugeWidget prediction={bundle.prediction} />
          </PageSection>
          <PageSection title="Keys to the game" subtitle="Hover to flip for staff notes">
            <KeysToGameCards keys={bundle.keys} />
          </PageSection>
          <PageSection title="Swing players" subtitle="Impact + trend">
            <SwingPlayersCards players={bundle.swingPlayers} />
          </PageSection>
          <PageSection title="Film notes" subtitle="Opponent prep">
            <FilmNotesPanel notes={bundle.filmNotes} game={bundle.game} />
          </PageSection>
          <PageSection title="Matchup radar" subtitle="UF vs opponent">
            <ScoutingRadarChart axes={bundle.radar} opponentName={bundle.game.opp} />
          </PageSection>
        </>
      ) : null}

      {tab === 'depth' ? (
        <PageSection title="Projected depth chart" subtitle="Starter · snap % · trend">
          <DepthChartGrid groups={bundle.depthChart} />
        </PageSection>
      ) : null}

      {tab === 'scouting' ? (
        <PageSection title="Scouting report" subtitle="Offense · defense · special teams">
          <ScoutingReportPanel scouting={bundle.scouting} />
        </PageSection>
      ) : null}

      {tab === 'prediction' ? (
        <PageSection title="GatorVault prediction" subtitle="Spread · total · expert picks">
          <PredictionPanel prediction={bundle.prediction} />
        </PageSection>
      ) : null}
    </div>
  );
}
`);

// Write VaultGameWeekPage update
add('client/components/vault/VaultGameWeekPage.tsx', `'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { PageLayout } from '@/components/brand';
import { GameWeekCommandCenter } from '@/components/vault/game-week/GameWeekCommandCenter';
import { InsiderPaywall } from '@/components/futurecast/InsiderPaywall';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { usePathname } from '@/lib/use-pathname';
import { isFilmRoomInsider } from '@/lib/futurecast-insider';

const GAME_WEEK_PAYWALL = {
  message:
    'Game Week unlocks matchup intel, opponent film prep, swing-player notes, and GatorVault predictions.',
  ctaLabel: 'Unlock Game Week + Film Room',
} as const;

export function VaultGameWeekPage(): React.ReactElement {
  const pathname = usePathname();
  const insider = isFilmRoomInsider();
  const urlGameId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.gameWeekGame),
    [pathname]
  );
  const [gameId, setGameId] = useState('fau');

  useEffect(() => {
    if (urlGameId && SCHEDULE_GAMES.some((g) => g.id === urlGameId)) {
      setGameId(urlGameId);
    }
  }, [urlGameId]);

  return (
    <div className="rh-page rh-page--elite gv-film-room-page mobile-app" data-testid="vault-game-week-elite">
      <PageLayout
        theme="navy"
        testId="vault-game-week"
        className="rh-elite-chrome"
        hero={
          <section className="rh-hero-strip" aria-label="Game Week">
            <div className="rh-hero-sweep" aria-hidden="true" />
            <div className="rh-hero-watermark" aria-hidden="true">
              GATORS
            </div>
            <div className="rh-hero-top">
              <div>
                <h1 className="rh-hero-title">Game Week</h1>
                <p className="rh-hero-subtitle">
                  Matchup spotlight, intel, and predictions — powered by FutureCast.
                </p>
              </div>
              <span className="rh-badge rh-hero-badge">GAME WEEK</span>
            </div>
          </section>
        }
      >
        <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
          <GameWeekCommandCenter initialGameId={gameId} onGameChange={setGameId} />
        </InsiderPaywall>

        {!insider ? (
          <a href="/join?tier=film" className="gv-paywall-sticky-cta">
            Unlock Game Week + Film Room · from $9.99/mo
          </a>
        ) : null}
      </PageLayout>
    </div>
  );
}
`);

// Patch layout - read and append import
const layoutPath = path.join(ROOT, 'client/app/vault/layout.tsx');
let layout = fs.readFileSync(layoutPath, 'utf8');
if (!layout.includes("game-week-wow.css")) {
  layout = layout.replace(
    "import '@/lib/uf-premium-home.css';",
    "import '@/lib/uf-premium-home.css';\nimport '@/lib/game-week-wow.css';"
  );
  files.set(layoutPath, layout);
}

// Write all files
for (const [filePath, content] of files) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

// Verify UTF-8 — no NUL bytes
const created = [...files.keys()];
const bad = [];
for (const f of created) {
  const buf = fs.readFileSync(f);
  if (buf.includes(0)) bad.push(f);
}

console.log('Created/updated', created.length, 'files:');
for (const f of created) {
  const rel = path.relative(ROOT, f);
  console.log(' ', rel);
}
if (bad.length) {
  console.error('NUL bytes found in:', bad);
  process.exit(1);
}
console.log('All files confirmed UTF-8 (no NUL bytes).');

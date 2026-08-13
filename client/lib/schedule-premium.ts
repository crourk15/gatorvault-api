import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { parseScheduleKickoff } from '@/lib/gators-live';
import { gameWeekRoute } from '@/lib/site-routes';

export type ScheduleSectionId = 'non-conference' | 'sec' | 'rivalry';
export type HomeOrAway = 'vs' | '@' | 'neutral';
export type ScheduleGameStatus = 'next' | 'upcoming' | 'past';

export type TicketVendor = {
  id: string;
  name: string;
  logo: string;
  url: string;
  /** Live marketplace floor only — never invent placeholders. */
  priceFrom?: number;
};

export type PremiumScheduleGame = {
  id: string;
  opponentName: string;
  opponentShort: string;
  opponentLogo: string;
  homeOrAway: HomeOrAway;
  date: string;
  time: string;
  /** Full kickoff label from schedule-data (for countdown / status). */
  kickoffRaw: string;
  stadium: string;
  tvNetwork: string;
  winProbability: number;
  predictedScoreUF: number;
  predictedScoreOpp: number;
  intelUrl: string;
  ticketVendors: TicketVendor[];
  section: ScheduleSectionId;
  /** Open date — no tickets / win model. */
  isBye?: boolean;
  /** One-line game-week teaser — never the full scout dump. */
  keyTeaser?: string;
};

export type ScheduleSectionMeta = {
  id: ScheduleSectionId;
  title: string;
  description: string;
};

export const SCHEDULE_SECTION_META: ScheduleSectionMeta[] = [
  {
    id: 'non-conference',
    title: 'Non-Conference',
    description: 'Season openers and tune-ups before SEC play begins.',
  },
  {
    id: 'sec',
    title: 'SEC Play',
    description: 'Conference matchups that define the Gators’ path to Atlanta.',
  },
  {
    id: 'rivalry',
    title: 'Rivalry Games',
    description: 'The games that matter most — Worlds Largest Outdoor Cocktail Party and the state finale.',
  },
];

const SECTION_BY_ID: Record<string, ScheduleSectionId> = {
  fau: 'non-conference',
  campbell: 'non-conference',
  auburn: 'sec',
  olemiss: 'sec',
  missouri: 'sec',
  texas: 'sec',
  'bye-oct24': 'sec',
  oklahoma: 'sec',
  kentucky: 'sec',
  vandy: 'sec',
  scar: 'sec',
  uga: 'rivalry',
  fsu: 'rivalry',
};

const OPPONENT_META: Record<string, { short: string; logo: string }> = {
  fau: { short: 'FAU', logo: 'FAU' },
  campbell: { short: 'CAM', logo: 'CAM' },
  auburn: { short: 'AUB', logo: 'AU' },
  olemiss: { short: 'MISS', logo: 'OM' },
  missouri: { short: 'MIZ', logo: 'MU' },
  texas: { short: 'TEX', logo: 'UT' },
  uga: { short: 'UGA', logo: 'UGA' },
  oklahoma: { short: 'OU', logo: 'OU' },
  kentucky: { short: 'UK', logo: 'UK' },
  vandy: { short: 'VAN', logo: 'VU' },
  scar: { short: 'SC', logo: 'SC' },
  fsu: { short: 'FSU', logo: 'FSU' },
};

const TV_PLACEHOLDERS = new Set(['FLEX', 'EARLY', 'NIGHT', 'TBD', '—', '-']);
const POSTGAME_MS = 5 * 3600_000;

export function isByeGame(game: Pick<ScheduleGame, 'kind' | 'id' | 'opp'>): boolean {
  if (game.kind === 'bye') return true;
  if (String(game.id || '').startsWith('bye')) return true;
  return /bye\s*week/i.test(String(game.opp || ''));
}

function homeOrAwayFromLabel(label: string, venue: string): HomeOrAway {
  if (label.includes('@')) return '@';
  const v = venue.toLowerCase();
  // Cocktail Party + other true neutrals (2026 UGA is Atlanta / Mercedes-Benz).
  if (
    v.includes('jacksonville') ||
    v.includes('mercedes') ||
    v.includes('atlanta')
  ) {
    return 'neutral';
  }
  return 'vs';
}

function parsePrediction(pred: string): { uf: number; opp: number } {
  // Prefer trailing score pair so multi-word names ("Ole Miss", "South Carolina") still parse.
  const match = pred.match(/UF\s+(\d+)\D+(\d+)\s*$/i);
  if (match) return { uf: Number(match[1]), opp: Number(match[2]) };
  return { uf: 0, opp: 0 };
}

function splitDateTime(date: string): { date: string; time: string } {
  const parts = date.split(' · ');
  if (parts.length >= 2) return { date: parts[0], time: parts.slice(1).join(' · ') };
  return { date, time: 'TBD' };
}

function normalizeTv(tv?: string): string {
  if (!tv || TV_PLACEHOLDERS.has(tv)) return 'TBD';
  return tv;
}

function isTicketEventUrl(url: string): boolean {
  // Real event / buy pages — not floridagators.com game-center or marketplace search.
  return /ticketmaster\.com|tickpick\.com|stubhub\.com\/.+\/event\/|seatgeek\.com\/.+/i.test(url);
}

function ticketVendorsForGame(game: ScheduleGame): TicketVendor[] {
  // Prefer per-game event deep links from the schedule board — not marketplace search pages.
  const t = game.tickets;
  const vendors: TicketVendor[] = [];
  const official = (t?.official || t?.ticketmaster || '').trim();
  if (official && isTicketEventUrl(official)) {
    vendors.push({ id: 'official', name: 'Official', logo: 'OF', url: official });
  }
  if (t?.tickpick && isTicketEventUrl(t.tickpick)) {
    vendors.push({ id: 'tickpick', name: 'TickPick', logo: 'TP', url: t.tickpick });
  }
  if (t?.stubhub && isTicketEventUrl(t.stubhub)) {
    vendors.push({ id: 'stubhub', name: 'StubHub', logo: 'SH', url: t.stubhub });
  }
  if (t?.seatgeek && isTicketEventUrl(t.seatgeek)) {
    vendors.push({ id: 'seatgeek', name: 'SeatGeek', logo: 'SG', url: t.seatgeek });
  }
  if (vendors.length) return vendors.slice(0, 3);

  // Last resort only when a game has no event URLs yet.
  const q = encodeURIComponent(`Florida Gators ${game.opp}`);
  return [
    {
      id: 'stubhub',
      name: 'StubHub',
      logo: 'SH',
      url: `https://www.stubhub.com/search?q=${q}`,
    },
    {
      id: 'seatgeek',
      name: 'SeatGeek',
      logo: 'SG',
      url: `https://seatgeek.com/search?q=${q}`,
    },
  ];
}

export function toPremiumScheduleGame(game: ScheduleGame): PremiumScheduleGame {
  const bye = isByeGame(game);
  const parsed = parsePrediction(game.pred);
  const uf = Number.isFinite(game.predUF) ? game.predUF : parsed.uf;
  const opp = Number.isFinite(game.predOpp) ? game.predOpp : parsed.opp;
  const { date, time } = splitDateTime(game.date);
  const meta = bye
    ? { short: 'BYE', logo: '—' }
    : OPPONENT_META[game.id] ?? { short: game.opp.slice(0, 3).toUpperCase(), logo: '🏈' };

  return {
    id: game.id,
    opponentName: bye ? 'Bye week' : game.opp,
    opponentShort: meta.short,
    opponentLogo: meta.logo,
    homeOrAway: bye ? 'neutral' : homeOrAwayFromLabel(game.label, game.venue),
    date,
    time: bye ? 'OFF' : time,
    kickoffRaw: game.date,
    stadium: game.venue,
    tvNetwork: bye ? '—' : normalizeTv(game.tv),
    winProbability: bye ? 0 : game.ufPct,
    predictedScoreUF: bye ? 0 : uf,
    predictedScoreOpp: bye ? 0 : opp,
    intelUrl: bye ? '/vault/schedule/' : gameWeekRoute(game.id),
    ticketVendors: bye ? [] : ticketVendorsForGame(game),
    section: SECTION_BY_ID[game.id] ?? 'sec',
    isBye: bye || undefined,
    keyTeaser: bye ? game.film || 'Open date' : game.keys[0],
  };
}

export const PREMIUM_SCHEDULE_2026: PremiumScheduleGame[] = SCHEDULE_GAMES.map(toPremiumScheduleGame);

export function groupGamesBySection(games: PremiumScheduleGame[]): Map<ScheduleSectionId, PremiumScheduleGame[]> {
  const map = new Map<ScheduleSectionId, PremiumScheduleGame[]>(
    SCHEDULE_SECTION_META.map((s) => [s.id, []]),
  );
  for (const game of games) {
    map.get(game.section)?.push(game);
  }
  return map;
}

/** Published + next unpublished season — skip empty past years. */
export const SCHEDULE_SEASONS = ['2026', '2027'] as const;
export type ScheduleSeason = (typeof SCHEDULE_SEASONS)[number];

export function gamesForSeason(season: ScheduleSeason): PremiumScheduleGame[] {
  if (season === '2026') return PREMIUM_SCHEDULE_2026;
  return [];
}

export function isRivalryGame(game: PremiumScheduleGame): boolean {
  return game.section === 'rivalry';
}

/** Next upcoming kickoff, or null when the season is complete / empty. */
export function getNextScheduleGame(
  games: PremiumScheduleGame[],
  now = new Date(),
): PremiumScheduleGame | null {
  let next: PremiumScheduleGame | null = null;
  let nextTs = Infinity;
  const t = now.getTime();

  for (const game of games) {
    if (game.isBye) continue;
    const kick = parseScheduleKickoff(game.kickoffRaw);
    if (!kick) continue;
    const end = kick.getTime() + POSTGAME_MS;
    if (t > end) continue;
    const ts = kick.getTime();
    if (ts < nextTs) {
      nextTs = ts;
      next = game;
    }
  }

  return next;
}

export function getScheduleGameStatus(
  game: PremiumScheduleGame,
  nextId: string | null,
  now = new Date(),
): ScheduleGameStatus {
  if (nextId && game.id === nextId) return 'next';
  const kick = parseScheduleKickoff(game.kickoffRaw);
  if (!kick) return 'upcoming';
  if (now.getTime() > kick.getTime() + POSTGAME_MS) return 'past';
  return 'upcoming';
}

export function daysUntilKickoffLabel(kickoffRaw: string, now = new Date()): string {
  const kick = parseScheduleKickoff(kickoffRaw);
  if (!kick) return '';
  const days = Math.ceil((kick.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return 'Game week';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** War Room / schedule board model summary — expected wins from win%, mode record from lean scores. */
export type SeasonModelSummary = {
  expectedWins: number;
  modeWins: number;
  modeLosses: number;
  modeRecord: string;
  gameCount: number;
  articleHref: string;
};

export function getSeasonModelSummary(games: PremiumScheduleGame[]): SeasonModelSummary {
  const counted = games.filter((g) => !g.isBye);
  const expectedWins = counted.reduce((sum, g) => sum + g.winProbability / 100, 0);
  const modeWins = counted.filter((g) => g.predictedScoreUF > g.predictedScoreOpp).length;
  const modeLosses = Math.max(0, counted.length - modeWins);
  return {
    expectedWins: Math.round(expectedWins * 10) / 10,
    modeWins,
    modeLosses,
    modeRecord: `${modeWins}-${modeLosses}`,
    gameCount: counted.length,
    articleHref: '/vault/articles/art-win-model/',
  };
}

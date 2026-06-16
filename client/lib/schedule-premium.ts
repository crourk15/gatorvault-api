import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { gameWeekRoute } from '@/lib/site-routes';

export type ScheduleSectionId = 'non-conference' | 'sec' | 'rivalry';
export type HomeOrAway = 'vs' | '@' | 'neutral';

export type TicketVendor = {
  id: string;
  name: string;
  logo: string;
  url: string;
  priceFrom: number;
};

export type PremiumScheduleGame = {
  id: string;
  opponentName: string;
  opponentShort: string;
  opponentLogo: string;
  homeOrAway: HomeOrAway;
  date: string;
  time: string;
  stadium: string;
  tvNetwork: string;
  winProbability: number;
  predictedScoreUF: number;
  predictedScoreOpp: number;
  intelUrl: string;
  ticketVendors: TicketVendor[];
  section: ScheduleSectionId;
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
  charlotte: 'non-conference',
  auburn: 'sec',
  olemiss: 'sec',
  missouri: 'sec',
  lsu: 'sec',
  texas: 'sec',
  oklahoma: 'sec',
  kentucky: 'sec',
  vandy: 'sec',
  scar: 'sec',
  uga: 'rivalry',
  fsu: 'rivalry',
};

const OPPONENT_META: Record<string, { short: string; logo: string }> = {
  fau: { short: 'FAU', logo: 'FAU' },
  charlotte: { short: 'CLT', logo: 'CLT' },
  auburn: { short: 'AUB', logo: 'AU' },
  olemiss: { short: 'MISS', logo: 'OM' },
  missouri: { short: 'MIZ', logo: 'MU' },
  lsu: { short: 'LSU', logo: 'LSU' },
  texas: { short: 'TEX', logo: 'UT' },
  uga: { short: 'UGA', logo: 'UGA' },
  oklahoma: { short: 'OU', logo: 'OU' },
  kentucky: { short: 'UK', logo: 'UK' },
  vandy: { short: 'VAN', logo: 'VU' },
  scar: { short: 'SC', logo: 'SC' },
  fsu: { short: 'FSU', logo: 'FSU' },
};

const TV_PLACEHOLDERS = new Set(['FLEX', 'EARLY', 'NIGHT', 'TBD']);

function homeOrAwayFromLabel(label: string, venue: string): HomeOrAway {
  if (label.includes('@')) return '@';
  if (venue.toLowerCase().includes('jacksonville')) return 'neutral';
  return 'vs';
}

function parsePrediction(pred: string): { uf: number; opp: number } {
  const match = pred.match(/UF\s+(\d+)\s*[·•]\s*\w+\s+(\d+)/i);
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

function ticketVendorsForGame(opponent: string): TicketVendor[] {
  const q = encodeURIComponent(`Florida Gators ${opponent}`);
  return [
    {
      id: 'stubhub',
      name: 'StubHub',
      logo: 'SH',
      url: `https://www.stubhub.com/search?q=${q}`,
      priceFrom: 45,
    },
    {
      id: 'seatgeek',
      name: 'SeatGeek',
      logo: 'SG',
      url: `https://seatgeek.com/search?q=${q}`,
      priceFrom: 42,
    },
    {
      id: 'vivid',
      name: 'VividSeats',
      logo: 'VS',
      url: `https://www.vividseats.com/search?q=${q}`,
      priceFrom: 48,
    },
  ];
}

export function toPremiumScheduleGame(game: ScheduleGame): PremiumScheduleGame {
  const { uf, opp } = parsePrediction(game.pred);
  const { date, time } = splitDateTime(game.date);
  const meta = OPPONENT_META[game.id] ?? { short: game.opp.slice(0, 3).toUpperCase(), logo: '🏈' };

  return {
    id: game.id,
    opponentName: game.opp,
    opponentShort: meta.short,
    opponentLogo: meta.logo,
    homeOrAway: homeOrAwayFromLabel(game.label, game.venue),
    date,
    time,
    stadium: game.venue,
    tvNetwork: normalizeTv(game.tv),
    winProbability: game.ufPct,
    predictedScoreUF: uf,
    predictedScoreOpp: opp,
    intelUrl: gameWeekRoute(game.id),
    ticketVendors: ticketVendorsForGame(game.opp),
    section: SECTION_BY_ID[game.id] ?? 'sec',
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

export const SCHEDULE_SEASONS = ['2025', '2026', '2027'] as const;
export type ScheduleSeason = (typeof SCHEDULE_SEASONS)[number];

export function gamesForSeason(season: ScheduleSeason): PremiumScheduleGame[] {
  if (season === '2026') return PREMIUM_SCHEDULE_2026;
  return [];
}

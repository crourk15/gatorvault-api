/**
 * GatorNation Live data layer — ticker, feed, panels, snapshot.
 */
import type {
  TickerTag,
  PodcastCardProps,
  RecruitingUpdateCardProps,
  RecruitingSnapshotProps,
  LivePanelProps,
  BreakingNewsItem,
  GnlGameDay,
} from './gatornation-live-types';
import { fetchLiveDashboard, type BeatPost, type LiveFeedItem, type PodcastShow } from './live-api';
import { fetchBettingLines, type BettingGame } from './betting-api';
import { SCHEDULE_GAMES } from './schedule-data';
import {
  PODCAST_CATALOG,
  resolvePodcastLogo,
  resolvePodcastLogoFallback,
  resolvePodcastStreams,
} from './podcast-catalog';

export const LIVE_HUB_REFRESH_MS = 45_000;

export type { TickerTag };

export type LiveTickerItem = {
  type: TickerTag;
  text: string;
  timestamp: string;
  source: string;
  url?: string;
};

export type LivePanelItems = {
  visitsNow: LivePanelProps['items'];
  portalBuzz: LivePanelProps['items'];
  beatWriterHighlights: LivePanelProps['items'];
  staffNotes: LivePanelProps['items'];
};

export const DEFAULT_PODCASTS: PodcastCardProps[] = PODCAST_CATALOG.map((entry) => {
  const streams = resolvePodcastStreams(entry.id);
  return {
    id: entry.id,
    title: entry.name,
    description: `${entry.name} — Florida Gators coverage.`,
    logoUrl: entry.logoUrl,
    thumbnailUrl: entry.logoFallback,
    hosts: entry.hosts,
    appleUrl: streams.appleUrl ?? '#',
    spotifyUrl: streams.spotifyUrl ?? '#',
    youtubeUrl: streams.youtubeUrl ?? '#',
    websiteUrl: streams.siteUrl ?? '#',
  };
});

const SOURCE_LOGOS: Record<string, string> = {
  on3: 'O3',
  rivals: 'RV',
  '247': '247',
  '247sports': '247',
  twitter: '𝕏',
  x: '𝕏',
  gatorvault: 'GV',
};

export function sourceBadge(source?: string): string {
  const key = String(source || 'GV').toLowerCase().replace(/\s+/g, '');
  for (const [k, v] of Object.entries(SOURCE_LOGOS)) {
    if (key.includes(k)) return v;
  }
  return source?.slice(0, 2).toUpperCase() || 'GV';
}

export function mapTickerTag(category: string, text: string): TickerTag {
  const blob = `${category} ${text}`.toLowerCase();
  if (blob.includes('podcast') || blob.includes('episode') || blob.includes('listen')) return 'PODCAST';
  if (blob.includes('team') || blob.includes('roster') || blob.includes('depth chart')) return 'TEAM';
  if (blob.includes('portal') || blob.includes('transfer')) return 'PORTAL';
  if (blob.includes('commit')) return 'COMMIT';
  if (blob.includes('visit') || blob.includes(' ov') || blob.includes('on campus')) return 'VISIT';
  if (blob.includes('rumor') || blob.includes('beat')) return 'RUMOR';
  if (blob.includes('break')) return 'BREAKING';
  return 'BREAKING';
}

export function tickerTagEmoji(tag: TickerTag): string {
  switch (tag) {
    case 'BREAKING':
      return '🔴';
    case 'VISIT':
      return '🟠';
    case 'COMMIT':
      return '🔵';
    case 'PORTAL':
      return '🟣';
    case 'RUMOR':
      return '🟢';
    case 'TEAM':
      return '🐊';
    case 'PODCAST':
      return '🎙';
    default:
      return '🔴';
  }
}

function parseKickoffIso(raw?: string | null): string | null {
  if (!raw) return null;
  const ms = Date.parse(raw);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  const match = raw.match(/^([A-Za-z]+ \d+, \d{4})/);
  if (!match) return null;
  const timeMatch = raw.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
  const combined = timeMatch ? `${match[1]} ${timeMatch[1]} ET` : match[1];
  const parsed = Date.parse(combined);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function opponentFromBettingGame(game: BettingGame): string {
  const away = game.awayTeam || game.away || '';
  const home = game.homeTeam || game.home || '';
  const blob = `${away} ${home}`.toLowerCase();
  if (blob.includes('florida') || blob.includes('gators')) {
    return away.toLowerCase().includes('florida') ? home : away;
  }
  return game.game || away || home || 'Next opponent';
}

export async function fetchGnlGameDay(): Promise<GnlGameDay | null> {
  try {
    const lines = await fetchBettingLines();
    const game = lines.nextGame;
    if (game) {
      const opponent = opponentFromBettingGame(game);
      const kickoffLabel = game.kickoff || game.date || 'Kickoff TBD';
      return {
        opponent,
        opponentAbbr: opponent.split(/\s+/)[0]?.slice(0, 4).toUpperCase() || 'OPP',
        kickoffIso: parseKickoffIso(game.kickoff || game.date),
        kickoffLabel,
        venue: 'Ben Hill Griffin Stadium',
      };
    }
  } catch {
    /* fall through to schedule seed */
  }

  const seed = SCHEDULE_GAMES[0];
  if (!seed) return null;
  return {
    opponent: seed.opp,
    opponentAbbr: seed.id.toUpperCase(),
    kickoffIso: parseKickoffIso(seed.date),
    kickoffLabel: seed.date,
    venue: seed.venue,
  };
}

function isExcludedTickerFeedItem(item: LiveFeedItem): boolean {
  const blob = `${item.url ?? ''} ${item.source ?? ''} ${item.title ?? ''}`.toLowerCase();
  if (blob.includes('futurecast')) return true;
  if (blob.includes('/recruiting-hub') || blob.includes('recruiting hub')) return true;
  return false;
}

/** Live dashboard feed only — deduped, newest first, no RH/FC sources. */
export function buildLiveDashboardTicker(feed: LiveFeedItem[]): LiveTickerItem[] {
  const seen = new Set<string>();
  const items: LiveTickerItem[] = [];

  const sorted = [...feed]
    .filter((item) => {
      const text = String(item.title || '').trim();
      return text && !isExcludedTickerFeedItem(item) && !isExcludedLiveFeedItem(item);
    })
    .sort((a, b) => {
      const ta = Date.parse(a.createdAt || '') || 0;
      const tb = Date.parse(b.createdAt || '') || 0;
      return tb - ta;
    });

  for (const item of sorted) {
    const text = String(item.title || '').trim();
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      type: mapTickerTag(String(item.type || item.source || ''), text),
      text,
      timestamp: item.createdAt || new Date().toISOString(),
      source: item.source || 'GatorVault',
      url: item.url,
    });
    if (items.length >= 16) break;
  }

  return items;
}

/** @deprecated Use buildLiveDashboardTicker */
export function enrichTickerFromFeed(_ticker: LiveTickerItem[], feed: LiveFeedItem[]): LiveTickerItem[] {
  return buildLiveDashboardTicker(feed);
}

export function pickBreakingNews(
  ticker: LiveTickerItem[],
  feed: LiveFeedItem[] | RecruitingUpdateCardProps[]
): BreakingNewsItem | null {
  const fromTicker = ticker.find((t) => t.type === 'BREAKING');
  if (fromTicker) {
    return {
      text: fromTicker.text,
      url: fromTicker.url || '/gator-nation-live',
      timestamp: fromTicker.timestamp,
      source: fromTicker.source,
    };
  }

  const fromFeed = feed.find((f) => {
    if ('headline' in f) {
      return /break/i.test(f.category) || /break/i.test(f.headline);
    }
    const title = String(f.title || '');
    const type = String(f.type || '');
    return /break/i.test(type) || /break/i.test(title);
  });
  if (fromFeed) {
    if ('headline' in fromFeed) {
      return {
        text: fromFeed.headline,
        url: fromFeed.url,
        timestamp: fromFeed.timestamp,
        source: fromFeed.source,
      };
    }
    return {
      text: String(fromFeed.title || ''),
      url: fromFeed.url || '/gator-nation-live',
      timestamp: fromFeed.createdAt || new Date().toISOString(),
      source: fromFeed.source || 'GatorVault',
    };
  }

  if (ticker[0]) {
    return {
      text: ticker[0].text,
      url: ticker[0].url || '/gator-nation-live',
      timestamp: ticker[0].timestamp,
      source: ticker[0].source,
    };
  }

  return null;
}

function isExcludedLiveFeedItem(item: LiveFeedItem): boolean {
  const blob = `${item.title ?? ''} ${item.type ?? ''}`.toLowerCase();
  if (!blob.trim()) return true;
  if (item.createdAt) {
    const ageMs = Date.now() - new Date(item.createdAt).getTime();
    if (Number.isFinite(ageMs) && ageMs > 48 * 60 * 60 * 1000) return true;
  }
  return false;
}

function platformUrl(
  platforms: { name: string; url: string }[],
  needle: string,
  fallback?: string
): string {
  const hit = platforms.find((p) => p.name.toLowerCase().includes(needle))?.url;
  if (hit && hit !== '#') return hit;
  return fallback ?? '#';
}

export function normalizePodcasts(shows: PodcastShow[]): PodcastCardProps[] {
  if (!shows.length) return DEFAULT_PODCASTS;
  return shows.slice(0, 4).map((show, idx) => {
    const platforms = show.platforms ?? [];
    const catalogKey = show.id ?? show.title ?? DEFAULT_PODCASTS[idx]?.id;
    const catalogStreams = resolvePodcastStreams(catalogKey);
    const fallback = DEFAULT_PODCASTS[idx];
    return {
      id: show.id ?? fallback?.id,
      title: show.title || fallback?.title || 'Podcast',
      description: show.description || fallback?.description || '',
      logoUrl:
        show.logoUrl ||
        resolvePodcastLogo(catalogKey) ||
        fallback?.logoUrl,
      thumbnailUrl:
        show.thumbnailUrl ||
        resolvePodcastLogoFallback(catalogKey) ||
        fallback?.thumbnailUrl,
      hosts: show.hosts?.length ? show.hosts : fallback?.hosts,
      appleUrl: platformUrl(platforms, 'apple', catalogStreams.appleUrl),
      spotifyUrl: platformUrl(platforms, 'spotify', catalogStreams.spotifyUrl),
      youtubeUrl: platformUrl(platforms, 'youtube', catalogStreams.youtubeUrl),
      websiteUrl:
        platformUrl(platforms, 'web', catalogStreams.siteUrl) ||
        platforms[0]?.url ||
        fallback?.websiteUrl ||
        '#',
      episodeTitle: show.episodeTitle,
      publishedAt: show.publishedAt,
    };
  });
}

export function buildLivePanels(feed: LiveFeedItem[], beat: BeatPost[]): LivePanelItems {
  const visitsNow = feed
    .filter((item) => /visit|on campus|ov/i.test(String(item.title)))
    .slice(0, 6)
    .map((item) => ({
      text: String(item.title || '').trim(),
      source: item.source || 'Recruiting',
      timestamp: item.createdAt || undefined,
    }));

  const portalBuzz = feed
    .filter((item) => /portal|transfer/i.test(String(item.title)))
    .slice(0, 6)
    .map((item) => ({
      text: String(item.title || '').trim(),
      source: 'Portal',
      timestamp: item.createdAt || undefined,
    }));

  const beatWriterHighlights = beat
    .filter((post) => String(post.text || '').trim())
    .slice(0, 12)
    .map((post) => {
      const writer = post.writerName || post.handle || post.outlet || 'Beat Writer';
      return {
        text: String(post.text || '').trim(),
        source: post.outlet || 'Beat',
        timestamp: post.publishedAt || undefined,
        url: post.url,
        handle: post.handle,
        writerName: writer,
      };
    });

  const staffNotes = feed
    .filter((item) => /staff|coach|internal/i.test(String(item.title)))
    .slice(0, 4)
    .map((item) => ({
      text: String(item.title || '').trim(),
      source: 'Insider',
      timestamp: item.createdAt || undefined,
    }));

  return { visitsNow, portalBuzz, beatWriterHighlights, staffNotes };
}

export type LiveHubBundle = {
  ticker: LiveTickerItem[];
  feed: RecruitingUpdateCardProps[];
  podcasts: PodcastCardProps[];
  panels: LivePanelItems;
  snapshot: RecruitingSnapshotProps & { momentumTrend: 'up' | 'down' | 'neutral' };
  movement: null;
  breakingNews: BreakingNewsItem | null;
  gameDay: GnlGameDay | null;
  updatedAt: string | null;
  refreshedAt: string | null;
};

/** GNL live bundle — live dashboard + beat writers + podcasts only (no RH/FC). */
export async function fetchLiveHubBundle(force = false): Promise<LiveHubBundle> {
  const [dash, gameDay] = await Promise.all([
    fetchLiveDashboard(40, { force }).catch(() => null),
    fetchGnlGameDay().catch(() => null),
  ]);

  const feedItems = dash?.feed ?? [];
  const beat = dash?.beat?.posts ?? [];
  const ticker = buildLiveDashboardTicker(feedItems);
  const refreshedAt = dash?.refreshedAt ?? dash?.updatedAt ?? new Date().toISOString();
  const shows = dash?.podcasts?.shows ?? [];
  const podcasts = shows.length > 0 ? normalizePodcasts(shows) : DEFAULT_PODCASTS;

  return {
    ticker,
    feed: [],
    podcasts,
    panels: buildLivePanels(feedItems, beat),
    snapshot: {
      commits: 0,
      nationalRank: null,
      secRank: null,
      blueChips: 0,
      inStatePercent: 0,
      momentum: 0,
      momentumTrend: 'neutral',
    },
    movement: null,
    breakingNews: pickBreakingNews(ticker, feedItems),
    gameDay,
    updatedAt: dash?.updatedAt ?? refreshedAt,
    refreshedAt,
  };
}

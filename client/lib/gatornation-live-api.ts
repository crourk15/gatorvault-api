/**
 * GatorNation Live data layer — ticker, feed, panels, snapshot.
 */
import type {
  TickerTag,
  PodcastCardProps,
  RecruitingUpdateCardProps,
  RecruitingSnapshotProps,
  LivePanelProps,
} from './gatornation-live-types';
import { fetchLiveTicker, fetchMovementPreview, computeMomentumPct } from './vault-dashboard-api';
import { fetchLiveDashboard, type BeatPost, type LiveFeedItem, type PodcastShow } from './live-api';
import { fetchRecruitingBoard } from './recruiting-board-api';

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

export const DEFAULT_PODCASTS: PodcastCardProps[] = [
  {
    title: 'Gators Breakdown',
    description: 'Daily Florida Gators analysis and recruiting intel.',
    thumbnailUrl: '/brand/logos/gv-monogram.svg',
    appleUrl: '#',
    spotifyUrl: '#',
    youtubeUrl: '#',
    websiteUrl: '#',
  },
  {
    title: 'Gator Nation Football Podcast',
    description: 'Deep-dive conversations on Florida football and culture.',
    thumbnailUrl: '/brand/logos/gv-monogram.svg',
    appleUrl: '#',
    spotifyUrl: '#',
    youtubeUrl: '#',
    websiteUrl: '#',
  },
  {
    title: 'Gators Online Podcast',
    description: 'Recruiting, team news, and insider notes from the beat.',
    thumbnailUrl: '/brand/logos/gatorvault-wordmark.svg',
    appleUrl: '#',
    spotifyUrl: '#',
    youtubeUrl: '#',
    websiteUrl: '#',
  },
  {
    title: 'Gator Tales',
    description: 'Official Florida Gators storytelling and interviews.',
    thumbnailUrl: '/brand/logos/gv-monogram.svg',
    appleUrl: '#',
    spotifyUrl: '#',
    youtubeUrl: '#',
    websiteUrl: '#',
  },
];

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
  if (blob.includes('portal') || blob.includes('transfer')) return 'PORTAL';
  if (blob.includes('commit')) return 'COMMIT';
  if (blob.includes('visit') || blob.includes(' ov') || blob.includes('on campus')) return 'VISIT';
  if (blob.includes('rumor') || blob.includes('beat')) return 'RUMOR';
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
    default:
      return '🔴';
  }
}

function feedCategory(item: LiveFeedItem): string {
  const blob = `${item.type ?? ''} ${item.title ?? ''}`.toLowerCase();
  if (blob.includes('commit')) return 'Commit';
  if (blob.includes('visit') || blob.includes('ov')) return 'Visit';
  if (blob.includes('portal')) return 'Portal';
  if (blob.includes('staff')) return 'Staff Note';
  if (blob.includes('rumor')) return 'Rumor';
  return 'Update';
}

function isExcludedLiveFeedItem(item: LiveFeedItem): boolean {
  const blob = `${item.title ?? ''} ${item.type ?? ''}`.toLowerCase();
  if (!blob.trim()) return true;
  const mentions2026 = /\b2026\b/.test(blob);
  if (mentions2026 && (blob.includes('commit') || blob.includes('signed'))) return true;
  if (mentions2026 && (blob.includes('portal') || blob.includes('transfer'))) return true;
  return false;
}

export function normalizePodcasts(shows: PodcastShow[]): PodcastCardProps[] {
  if (!shows.length) return DEFAULT_PODCASTS;
  return shows.slice(0, 4).map((show, idx) => {
    const platforms = show.platforms ?? [];
    const find = (name: string) =>
      platforms.find((p) => p.name.toLowerCase().includes(name))?.url || '#';
    return {
      title: show.title || DEFAULT_PODCASTS[idx]?.title || 'Podcast',
      description: show.description || DEFAULT_PODCASTS[idx]?.description || '',
      thumbnailUrl:
        show.thumbnailUrl ||
        DEFAULT_PODCASTS[idx]?.thumbnailUrl ||
        '/brand/logos/gv-monogram.svg',
      appleUrl: find('apple'),
      spotifyUrl: find('spotify'),
      youtubeUrl: find('youtube'),
      websiteUrl: find('web') || platforms[0]?.url || '#',
    };
  });
}

export function buildRecruitingFeed(feed: LiveFeedItem[]): RecruitingUpdateCardProps[] {
  return feed
    .filter((item) => item.title && !isExcludedLiveFeedItem(item))
    .slice(0, 24)
    .map((item) => ({
      source: item.source || 'GatorVault',
      headline: String(item.title),
      url: item.url || '/vault/live',
      timestamp: item.createdAt || new Date().toISOString(),
      category: feedCategory(item),
    }));
}

export function buildLivePanels(feed: LiveFeedItem[], beat: BeatPost[]): LivePanelItems {
  const visitsNow = feed
    .filter((item) => /visit|on campus|ov/i.test(String(item.title)))
    .slice(0, 6)
    .map((item) => ({
      text: String(item.title).slice(0, 80),
      source: item.source || 'Recruiting',
      timestamp: item.createdAt || undefined,
    }));

  const portalBuzz = feed
    .filter((item) => /portal|transfer/i.test(String(item.title)))
    .slice(0, 6)
    .map((item) => ({
      text: String(item.title).slice(0, 80),
      source: 'Portal',
      timestamp: item.createdAt || undefined,
    }));

  const beatWriterHighlights = beat.slice(0, 6).map((post) => {
    const writer = post.writerName || post.handle || post.outlet || 'Beat Writer';
    const snippet = String(post.text || '').slice(0, 80);
    return {
      text: `${writer}: “${snippet}${snippet.length >= 80 ? '…' : ''}”`,
      source: post.outlet || 'Beat',
      timestamp: post.publishedAt || undefined,
    };
  });

  const staffNotes = feed
    .filter((item) => /staff|coach|internal/i.test(String(item.title)))
    .slice(0, 4)
    .map((item) => ({
      text: String(item.title).slice(0, 72),
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
  movement: Awaited<ReturnType<typeof fetchMovementPreview>> | null;
  updatedAt: string | null;
};

export async function fetchLiveHubBundle(force = false): Promise<LiveHubBundle> {
  const [tickerRes, dash, board27, movement] = await Promise.all([
    fetchLiveTicker(force).catch(() => null),
    fetchLiveDashboard(40).catch(() => null),
    fetchRecruitingBoard(2027).catch(() => null),
    fetchMovementPreview(force).catch(() => null),
  ]);

  const feedItems = dash?.feed ?? [];
  const beat = dash?.beat?.posts ?? [];
  const now = new Date().toISOString();

  const ticker: LiveTickerItem[] = (tickerRes?.items ?? [])
    .filter((item) => !isExcludedLiveFeedItem({ title: item.text, type: item.category }))
    .map((item) => ({
    type: mapTickerTag(item.category, item.text),
    text: item.text,
    timestamp: tickerRes?.updatedAt || now,
    source: item.source || 'GatorVault',
    url: item.url,
  }));

  const commits = board27?.commits ?? [];
  const blueChips = commits.filter((c) => (Number(c.stars) || 0) >= 4).length;
  const inStateCount = commits.filter((c) => c.inState).length;
  const inStatePercent = commits.length ? Math.round((inStateCount / commits.length) * 100) : 0;
  const momentum = computeMomentumPct(movement?.heatmap, board27?.rankings?.classScore ?? null);

  return {
    ticker,
    feed: buildRecruitingFeed(feedItems),
    podcasts: normalizePodcasts(dash?.podcasts?.shows ?? []),
    panels: buildLivePanels(feedItems, beat),
    snapshot: {
      commits: commits.length,
      nationalRank: board27?.rankings?.nationalRank ?? null,
      secRank: board27?.rankings?.secRank ?? null,
      blueChips,
      inStatePercent,
      momentum,
      momentumTrend: momentum >= 65 ? 'up' : momentum <= 45 ? 'down' : 'neutral',
    },
    movement,
    updatedAt: dash?.updatedAt ?? tickerRes?.updatedAt ?? null,
  };
}

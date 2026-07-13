import type { LiveFeedItem } from '@/lib/live-api';

export const LIVE_REFRESH_MS = 45_000;
export const LIVE_STATE_KEY = 'live';

/** Hide category chips entirely when the stream is this thin. */
export const LIVE_FEED_CHIP_MIN_ITEMS = 3;

export type FeedCategory = 'all' | 'news' | 'recruiting' | 'portal' | 'game' | 'podcast';

export const CATEGORY_CHIPS: { id: FeedCategory; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: '⚡' },
  { id: 'news', label: 'Headlines', icon: '📰' },
  { id: 'recruiting', label: 'Recruiting', icon: '🎯' },
  { id: 'portal', label: 'Portal', icon: '🔄' },
  { id: 'game', label: 'Game Week', icon: '🏈' },
  { id: 'podcast', label: 'Audio', icon: '🎙️' },
];

export const TYPE_ICONS: Record<string, string> = {
  news: '📰',
  headline: '📰',
  recruiting: '🎯',
  portal: '🔄',
  transfer: '🔄',
  game: '🏈',
  score: '📊',
  podcast: '🎙️',
  beat: '✍️',
  x: '𝕏',
};

export function timeAgo(iso?: string): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'Just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function feedIcon(item: LiveFeedItem): string {
  const t = String(item.type ?? item.source ?? 'news').toLowerCase();
  for (const [key, icon] of Object.entries(TYPE_ICONS)) {
    if (t.includes(key)) return icon;
  }
  return '📌';
}

/**
 * Fan-facing source label — never show internal ids like `auto:on3-team-news`.
 * @deprecated import from `@/lib/live-source-label`
 */
export { formatLiveSourceLabel } from '@/lib/live-source-label';

function itemBlob(item: LiveFeedItem): string {
  return `${item.type ?? ''} ${item.source ?? ''} ${item.title ?? ''}`.toLowerCase();
}

/**
 * Honest category matchers — commits → recruiting, portal/transfer → portal, etc.
 * Avoid catch-alls like matching every "Florida/gator" line as Game Week.
 */
export function matchesCategory(item: LiveFeedItem, cat: FeedCategory): boolean {
  if (cat === 'all') return true;
  const blob = itemBlob(item);

  if (cat === 'recruiting') {
    return (
      /\b(recruit|commit|commits|committed|target|targets|visit|visits|offer|offers|signing|ov)\b/.test(
        blob
      ) || blob.includes('recruiting')
    );
  }

  if (cat === 'portal') {
    return /\b(portal|transfer|transfers|entered the portal|transfer portal)\b/.test(blob);
  }

  if (cat === 'podcast') {
    return /\b(podcast|episode|audio|listen)\b/.test(blob);
  }

  if (cat === 'game') {
    return (
      /\b(game week|kickoff|kick off|final score|box score|preview|matchup|injury report)\b/.test(
        blob
      ) ||
      /\b(score|scored|touchdown|field goal|halftime)\b/.test(blob) ||
      blob.includes('schedule')
    );
  }

  if (cat === 'news') {
    // Headlines = general news that is not clearly recruiting / portal / podcast / game.
    if (matchesCategory(item, 'recruiting')) return false;
    if (matchesCategory(item, 'portal')) return false;
    if (matchesCategory(item, 'podcast')) return false;
    if (matchesCategory(item, 'game')) return false;
    return true;
  }

  return true;
}

/** Chips with at least one item — Always includes All when chips are shown. */
export function visibleFeedCategories(feed: LiveFeedItem[]): FeedCategory[] {
  if (feed.length < LIVE_FEED_CHIP_MIN_ITEMS) return [];

  const cats: FeedCategory[] = ['all'];
  for (const chip of CATEGORY_CHIPS) {
    if (chip.id === 'all') continue;
    if (feed.some((item) => matchesCategory(item, chip.id))) {
      cats.push(chip.id);
    }
  }
  // Only All would be pointless — hide the bar.
  return cats.length > 1 ? cats : [];
}

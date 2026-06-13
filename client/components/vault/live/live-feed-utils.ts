import type { LiveFeedItem } from '@/lib/live-api';

export const LIVE_REFRESH_MS = 60_000;
export const LIVE_STATE_KEY = 'live';

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

export function matchesCategory(item: LiveFeedItem, cat: FeedCategory): boolean {
  if (cat === 'all') return true;
  const blob = `${item.type ?? ''} ${item.source ?? ''} ${item.title ?? ''}`.toLowerCase();
  if (cat === 'news') return blob.includes('news') || blob.includes('headline') || !blob.includes('recruit');
  if (cat === 'recruiting') return blob.includes('recruit') || blob.includes('commit') || blob.includes('target');
  if (cat === 'portal') return blob.includes('portal') || blob.includes('transfer');
  if (cat === 'game') return blob.includes('game') || blob.includes('score') || blob.includes('gator');
  if (cat === 'podcast') return blob.includes('podcast') || blob.includes('audio');
  return true;
}

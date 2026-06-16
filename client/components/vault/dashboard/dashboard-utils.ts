import { SITE_ROUTES } from '@/lib/site-routes';
import type { ContentLatestResponse, PersonalizedResponse } from '@/lib/vault-dashboard-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { playerProfilePath } from '@/lib/player-routes';

export function timeAgo(iso?: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return '';
  if (ms < 60_000) return 'Just now';
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Clean live strip labels for dashboard ticker */
export const TICKER_STRIP_LABEL: Record<string, string> = {
  portal: 'Portal Buzz',
  recruiting: 'Commit Watch',
  beat: 'Beat Writer Notes',
  nil: 'NIL Movement',
  breaking: 'Breaking',
  injury: 'Injury',
  staff: 'Staff',
};

export const TICKER_CATEGORY_LABEL = TICKER_STRIP_LABEL;

export const QUICK_ACTIONS = [
  { href: SITE_ROUTES.recruiting, icon: '🎯', label: 'Recruiting Hub', desc: 'Board & targets' },
  { href: SITE_ROUTES.futurecast, icon: '📈', label: 'FutureCast', desc: 'Predictions & intel' },
  { href: SITE_ROUTES.team, icon: '👥', label: 'Team', desc: 'Roster & depth' },
  { href: SITE_ROUTES.gameWeek, icon: '🏈', label: 'Game Week', desc: 'Matchup prep' },
  { href: SITE_ROUTES.filmRoom, icon: '📺', label: 'Film Room', desc: 'Breakdowns & clips' },
  { href: SITE_ROUTES.nil, icon: '💰', label: 'NIL Tracker', desc: 'Deals & rankings' },
  { href: SITE_ROUTES.community, icon: '💬', label: 'Community', desc: 'Threads & takes' },
] as const;

export type WatchlistItem = {
  id: string;
  name: string;
  subtitle?: string;
  href?: string;
  badge?: string;
  trend?: 'up' | 'down' | 'flat';
};

export type MovementFeedItem = {
  id: string;
  type: 'commit' | 'portal' | 'movement' | 'content';
  title: string;
  meta?: string;
  href?: string;
  icon?: string;
};

export function buildWatchlistItems(data: PersonalizedResponse | null): WatchlistItem[] {
  if (!data) return [];

  const fromSaved = data.savedPlayers.slice(0, 8).map((p, idx) => ({
    id: `saved_${p.slug ?? p.name}_${idx}`,
    name: p.name,
    subtitle: 'Followed player',
    href: p.slug ? playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast') : undefined,
    badge: 'Followed',
    trend: 'flat' as const,
  }));

  if (fromSaved.length >= 3) return fromSaved;

  const fromWatchlist = data.watchlist.flatMap((w, idx) => {
    if (w.count && w.count > 0) {
      return Array.from({ length: Math.min(w.count, 4) }, (_, i) => ({
        id: `watch_${idx}_${i}`,
        name: w.label,
        subtitle: `${w.count} tracked`,
        href: w.href,
        badge: 'Watchlist',
        trend: 'flat' as const,
      }));
    }
    return {
      id: `watch_${idx}`,
      name: w.label,
      href: w.href,
      badge: 'Watchlist',
      trend: 'flat' as const,
    };
  });

  const merged = [...fromSaved, ...fromWatchlist];
  if (merged.length > 0) return merged.slice(0, 10);

  return [
    { id: 'demo_1', name: '4★ ATH — Trending UF', subtitle: 'Movement +12%', badge: 'Target', trend: 'up' },
    { id: 'demo_2', name: 'Portal EDGE', subtitle: 'From Auburn', badge: 'Portal In', trend: 'up' },
    { id: 'demo_3', name: '2027 WR', subtitle: 'SEC interest rising', badge: 'Commit Watch', trend: 'flat' },
    { id: 'demo_4', name: '5★ DL', subtitle: 'Official visit set', badge: 'Target', trend: 'up' },
  ];
}

export function buildMovementFeedItems(
  movement: StaffDashboardResponse | null,
  content: ContentLatestResponse | null
): MovementFeedItem[] {
  const items: MovementFeedItem[] = [];

  movement?.alerts?.slice(0, 4).forEach((alert, idx) => {
    const lower = (alert.message ?? '').toLowerCase();
    const type = lower.includes('portal') ? 'portal' : lower.includes('commit') ? 'commit' : 'movement';
    items.push({
      id: `alert_${idx}`,
      type,
      title: alert.message ?? 'Movement alert',
      icon: type === 'portal' ? '🚪' : type === 'commit' ? '🐊' : '📈',
    });
  });

  movement?.topRisers?.slice(0, 3).forEach((p) => {
    items.push({
      id: `rise_${p.id}`,
      type: 'movement',
      title: `${p.name} trending up`,
      meta: p.delta != null ? `+${p.delta} movement score` : 'UF/SEC movement',
      href: playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast'),
      icon: '↑',
    });
  });

  movement?.topFallers?.slice(0, 2).forEach((p) => {
    items.push({
      id: `fall_${p.id}`,
      type: 'movement',
      title: `${p.name} cooling off`,
      meta: p.delta != null ? `${p.delta} movement score` : undefined,
      href: playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast'),
      icon: '↓',
    });
  });

  const contentRows = [
    ...(content?.articles ?? []).slice(0, 2).map((c) => ({ ...c, kind: 'article' as const })),
    ...(content?.podcasts ?? []).slice(0, 1).map((c) => ({ ...c, kind: 'podcast' as const })),
    ...(content?.filmRoom ?? []).slice(0, 1).map((c) => ({ ...c, kind: 'film' as const })),
    ...(content?.community ?? []).slice(0, 1).map((c) => ({ ...c, kind: 'community' as const })),
  ];

  contentRows.forEach((row) => {
    items.push({
      id: `content_${row.id}`,
      type: 'content',
      title: row.title,
      meta: [row.source, row.timestamp ? timeAgo(row.timestamp) : null].filter(Boolean).join(' · '),
      href: row.href,
      icon: row.icon ?? (row.kind === 'podcast' ? '🎙️' : row.kind === 'film' ? '🎬' : '📰'),
    });
  });

  return items.slice(0, 12);
}

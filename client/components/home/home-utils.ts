import { SITE_ROUTES } from '@/lib/site-routes';
import type { ContentLatestResponse, PersonalizedResponse } from '@/lib/vault-home-api';
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

export const TICKER_STRIP_LABEL: Record<string, string> = {
  portal: 'Portal Buzz',
  recruiting: 'Commit Watch',
  beat: 'Beat Writer Notes',
  nil: 'NIL Movement',
  breaking: 'Breaking',
  injury: 'Injury',
  staff: 'Staff',
};

export const QUICK_ACTIONS = [
  { href: SITE_ROUTES.recruiting, icon: '🎯', label: 'Recruiting Hub', desc: 'Board & targets' },
  { href: SITE_ROUTES.futurecast, icon: '📈', label: 'FutureCast', desc: 'Predictions & intel' },
  { href: SITE_ROUTES.team, icon: '👥', label: 'Team', desc: 'Roster & depth' },
  { href: SITE_ROUTES.gameWeek, icon: '🏈', label: 'Game Week', desc: 'Matchup prep' },
  { href: SITE_ROUTES.filmRoom, icon: '📺', label: 'Film Room', desc: 'Breakdowns & clips' },
  { href: SITE_ROUTES.nil, icon: '💰', label: 'NIL Tracker', desc: 'Deals & rankings' },
  { href: SITE_ROUTES.community, icon: '💬', label: 'Community', desc: 'Threads & takes' },
] as const;

export type MovementFeedItem = {
  id: string;
  type: 'commit' | 'portal' | 'movement' | 'content';
  title: string;
  meta?: string;
  href?: string;
  icon?: string;
};

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

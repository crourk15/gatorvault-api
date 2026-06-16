import { SITE_ROUTES } from '@/lib/site-routes';

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

export const TICKER_CATEGORY_LABEL: Record<string, string> = {
  recruiting: 'RECRUITING',
  portal: 'PORTAL',
  nil: 'NIL',
  injury: 'INJURY',
  staff: 'STAFF',
  beat: 'BEAT',
  breaking: 'BREAKING',
};

export const QUICK_ACTIONS = [
  { href: SITE_ROUTES.recruiting, icon: '🎯', label: 'Recruiting Hub' },
  { href: SITE_ROUTES.futurecast, icon: '📈', label: 'FutureCast' },
  { href: SITE_ROUTES.team, icon: '👥', label: 'Team' },
  { href: SITE_ROUTES.gameWeek, icon: '🏈', label: 'Game Week' },
  { href: SITE_ROUTES.filmRoom, icon: '📺', label: 'Film Room' },
  { href: SITE_ROUTES.nil, icon: '💰', label: 'NIL Tracker' },
  { href: SITE_ROUTES.community, icon: '💬', label: 'Community' },
] as const;

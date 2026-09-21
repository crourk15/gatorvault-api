import type { CommunityLockerThread } from './community-api';

const SEEN_KEY = 'gv_community_seen_v1';

function seenStorageKey(email: string): string {
  return `${SEEN_KEY}:${String(email || '').trim().toLowerCase()}`;
}

export function communityTimeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const ms = Date.now() - then;
  if (ms < 45000) return 'Just now';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(then));
  } catch {
    return `${days}d ago`;
  }
}

export function loadCommunitySeen(email?: string | null): Record<string, string> {
  if (!email || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(seenStorageKey(email));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markCommunitySeen(
  email: string | null | undefined,
  threadId: string,
  at?: string,
): Record<string, string> {
  if (!email || !threadId || typeof window === 'undefined') return {};
  const next = { ...loadCommunitySeen(email), [threadId]: at || new Date().toISOString() };
  try {
    window.localStorage.setItem(seenStorageKey(email), JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

/** True when someone else moved the thread after the last time you opened it. */
export function threadHasNewReply(
  thread: Pick<CommunityLockerThread, 'lastActivityAt' | 'lastReply' | 'replyCount'>,
  seenAt?: string,
): boolean {
  const last = thread.lastReply;
  if (!last || last.isYours) return false;
  const activity = last.createdAt || thread.lastActivityAt;
  if (!activity) return (thread.replyCount || 0) > 0;
  if (!seenAt) return true;
  return new Date(activity).getTime() > new Date(seenAt).getTime();
}

export function lockerRoleLabel(role?: CommunityLockerThread['yourRole']): string {
  if (role === 'started') return 'You started';
  if (role === 'replied') return 'You commented';
  if (role === 'following') return 'In locker';
  if (role === 'gameday') return 'Game talk';
  return '';
}

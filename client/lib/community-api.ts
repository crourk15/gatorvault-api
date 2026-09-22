import { apiFetch } from './api-fetch';
import { fetchWithWarmPoll } from './api-warm-poll';
import { loadSession } from './auth-api';
import type { ReportReasonId } from './community-ugc';

export type CommunityAuthor = {
  displayName?: string;
  avatarUrl?: string | null;
  tier?: string;
  isFounding?: boolean;
};

export type CommunityCategory = {
  id: string;
  slug: string;
  name?: string;
  label?: string;
  description?: string;
};

export type CommunityLastReply = {
  id: string;
  authorDisplay?: string;
  authorEmail?: string | null;
  bodyPreview?: string;
  createdAt?: string;
  isYours?: boolean;
};

export type CommunityThread = {
  id: string;
  title: string;
  body?: string;
  categorySlug?: string;
  categoryLabel?: string;
  authorId?: string;
  authorEmail?: string;
  authorDisplay?: string;
  author?: CommunityAuthor | null;
  replyCount?: number;
  viewCount?: number;
  pinned?: boolean;
  featured?: boolean;
  locked?: boolean;
  flagged?: boolean;
  createdAt?: string;
  lastActivityAt?: string;
  editedAt?: string;
  dailyKey?: string;
  gameday?: boolean;
  category?: { name?: string; slug?: string } | null;
  lastReply?: CommunityLastReply | null;
  yourReplyCount?: number;
  yourRole?: 'started' | 'replied' | 'following' | 'gameday' | null;
};

export type CommunityLockerThread = CommunityThread;

export type CommunityReplyOnYours = {
  threadId: string;
  title: string;
  replyCount?: number;
  lastReplyAt?: string;
  lastReplyPreview?: string;
  lastReplyAuthor?: string;
};

export type CommunityMe = {
  user?: { id?: string; displayName?: string; email?: string };
  locker?: CommunityLockerThread[];
  started?: CommunityLockerThread[];
  replied?: CommunityLockerThread[];
  following?: CommunityLockerThread[];
  repliesOnYours?: CommunityReplyOnYours[];
  gameRooms?: CommunityLockerThread[];
};

export type CommunityPost = {
  id: string;
  body: string;
  authorId?: string;
  authorEmail?: string;
  authorDisplay?: string;
  author?: CommunityAuthor | null;
  flagged?: boolean;
  createdAt?: string;
  editedAt?: string;
};

export type CommunityPulse = {
  threadCount?: number;
  postCount?: number;
  activeToday?: number;
  repliesToday?: number;
  trending?: number;
  topCategory?: string;
};

export type LiveRoom = {
  id: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  startsAt?: string;
  status?: string;
};

export type CommunityPageData = {
  categories: CommunityCategory[];
  threads: CommunityThread[];
  pulse: CommunityPulse;
  rooms: LiveRoom[];
  gameRooms?: CommunityLockerThread[];
  me?: CommunityMe | null;
  followed?: string[];
};

function authHeaders(json = false): HeadersInit {
  const session = loadSession();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (json) headers['Content-Type'] = 'application/json';
  if (session?.token) headers.Authorization = `Bearer ${session.token}`;
  return headers;
}

function communityFetchInit(json = false): RequestInit {
  return {
    credentials: 'include',
    headers: authHeaders(json),
  };
}

export function communityAuthorLabel(item: {
  author?: CommunityAuthor | null;
  authorDisplay?: string;
  authorEmail?: string;
}): string {
  const named =
    String(item.author?.displayName || '').trim() ||
    String(item.authorDisplay || '').trim();
  if (named) return named;
  const email = String(item.authorEmail || '').trim();
  if (email.includes('@')) return email.split('@')[0] || 'Member';
  return 'Member';
}

export async function fetchCommunityCategories(): Promise<CommunityCategory[]> {
  const data = await apiFetch<{ categories?: CommunityCategory[] }>(
    '/api/community/categories',
    communityFetchInit(),
  );
  return data.categories ?? [];
}

export async function fetchCommunityThreads(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<CommunityThread[]> {
  const bundle = await fetchCommunityThreadsBundle(opts);
  return bundle.threads;
}

export async function fetchCommunityThreadsBundle(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<{ threads: CommunityThread[]; followed: string[] }> {
  const params = new URLSearchParams();
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.category) params.set('category', opts.category);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ threads?: CommunityThread[]; followed?: string[] }>(
    `/api/community/threads${qs ? `?${qs}` : ''}`,
    communityFetchInit(),
  );
  return { threads: data.threads ?? [], followed: data.followed ?? [] };
}

export async function fetchCommunityThread(id: string): Promise<{
  thread: CommunityThread;
  posts: CommunityPost[];
  following?: boolean;
}> {
  const data = await apiFetch<{
    thread?: CommunityThread;
    posts?: CommunityPost[];
    author?: CommunityAuthor | null;
    following?: boolean;
  }>(`/api/community/thread/${encodeURIComponent(id)}`, communityFetchInit());
  if (!data.thread) throw new Error('Thread not found');
  const thread = { ...data.thread };
  // Older API nested author only at top-level; prefer thread.author, then merge top-level.
  if (!thread.author?.displayName && data.author?.displayName) {
    thread.author = data.author;
    thread.authorDisplay = data.author.displayName;
  } else if (!thread.authorDisplay && thread.author?.displayName) {
    thread.authorDisplay = thread.author.displayName;
  }
  return { thread, posts: data.posts ?? [], following: Boolean(data.following) };
}

export async function fetchCommunityGameRooms(limit = 8): Promise<CommunityLockerThread[]> {
  const data = await apiFetch<{ gameRooms?: CommunityLockerThread[] }>(
    `/api/community/game-rooms?limit=${encodeURIComponent(String(limit))}`,
    communityFetchInit(),
  );
  return data.gameRooms ?? [];
}

export async function fetchMyCommunity(): Promise<CommunityMe | null> {
  const session = loadSession();
  if (!session?.email) return null;
  const data = await apiFetch<{ me?: CommunityMe }>('/api/community/me', communityFetchInit());
  return data.me ?? null;
}

export async function toggleCommunityFollow(threadId: string): Promise<{ following: boolean }> {
  const data = await apiFetch<{ following?: boolean }>(
    `/api/community/thread/${encodeURIComponent(threadId)}/follow`,
    {
      ...communityFetchInit(true),
      method: 'POST',
    },
  );
  return { following: Boolean(data.following) };
}

export async function fetchCommunityPulse(): Promise<CommunityPulse> {
  const data = await apiFetch<{ pulse?: CommunityPulse }>('/api/community/pulse', communityFetchInit());
  return data.pulse ?? {};
}

export async function fetchLiveRooms(): Promise<LiveRoom[]> {
  const data = await apiFetch<{ rooms?: LiveRoom[] }>('/api/community/live-rooms', communityFetchInit());
  return data.rooms ?? [];
}

const COMMUNITY_LAST_GOOD_KEY = 'gv-community-page-last-good';
const COMMUNITY_LAST_GOOD_MAX_MS = 24 * 60 * 60_000;

function publicCommunityPage(data: CommunityPageData): CommunityPageData {
  return {
    categories: data.categories || [],
    threads: data.threads || [],
    pulse: data.pulse || {},
    rooms: data.rooms || [],
    gameRooms: data.gameRooms || [],
    me: null,
    followed: [],
  };
}

/** Sync first paint — last live hub, not the July seed. */
export function peekLastGoodCommunityPage(): CommunityPageData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(COMMUNITY_LAST_GOOD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; payload?: CommunityPageData };
    if (!parsed?.payload || Date.now() - Number(parsed.savedAt || 0) > COMMUNITY_LAST_GOOD_MAX_MS) {
      return null;
    }
    if (!parsed.payload.threads?.length && !parsed.payload.categories?.length) return null;
    return publicCommunityPage(parsed.payload);
  } catch {
    return null;
  }
}

export function writeLastGoodCommunityPage(data: CommunityPageData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      COMMUNITY_LAST_GOOD_KEY,
      JSON.stringify({ savedAt: Date.now(), payload: publicCommunityPage(data) })
    );
  } catch {
    /* quota / private mode */
  }
}

function communityPageQuery(opts: { sort?: string; category?: string; limit?: number } = {}): string {
  const params = new URLSearchParams();
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.category) params.set('category', opts.category);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchCommunityPageBundle(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<CommunityPageData> {
  const data = await apiFetch<CommunityPageData & { ok?: boolean }>(
    `/api/community/page${communityPageQuery(opts)}`,
    { ...communityFetchInit(), timeoutMs: 8_000, retries: 1, retryDelayMs: 800 }
  );
  if (!data || !Array.isArray(data.threads)) {
    throw new Error('community page empty');
  }
  return {
    categories: data.categories ?? [],
    threads: data.threads ?? [],
    pulse: data.pulse ?? {},
    rooms: data.rooms ?? [],
    gameRooms: data.gameRooms ?? [],
    me: data.me ?? null,
    followed: data.followed ?? [],
  };
}

async function fetchCommunityPageDataLegacy(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<CommunityPageData> {
  const signedIn = Boolean(loadSession()?.email);
  const [categories, threadBundle, pulse, rooms, gameRooms, me] = await Promise.all([
    fetchCommunityCategories(),
    fetchCommunityThreadsBundle(opts),
    fetchCommunityPulse(),
    fetchLiveRooms(),
    fetchCommunityGameRooms(8),
    signedIn ? fetchMyCommunity().catch(() => null) : Promise.resolve(null),
  ]);
  return {
    categories,
    threads: threadBundle.threads,
    followed: threadBundle.followed,
    pulse,
    rooms,
    gameRooms,
    me,
  };
}

/** Load community hub data — one page GET when live, last-good/seed while it warms. */
export async function fetchCommunityPageData(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<CommunityPageData> {
  // Seed / last-good already paint the hub — do not 10×2s warm-poll on mobile.
  const poll = { maxAttempts: 3, delayMs: 700 };

  return fetchWithWarmPoll(async () => {
    const signedIn = Boolean(loadSession()?.email);
    try {
      const [page, me] = await Promise.all([
        fetchCommunityPageBundle(opts),
        signedIn ? fetchMyCommunity().catch(() => null) : Promise.resolve(null),
      ]);
      writeLastGoodCommunityPage(page);
      return { ...page, me };
    } catch {
      const legacy = await fetchCommunityPageDataLegacy(opts);
      writeLastGoodCommunityPage(legacy);
      return legacy;
    }
  }, poll);
}

/** Warm Community from Home so the locker is not six cold GETs. */
export function prefetchCommunityPage(): void {
  if (typeof window === 'undefined') return;
  void fetchCommunityPageData({ sort: 'recent', limit: 40 }).catch(() => {});
}

export async function createCommunityThread(input: {
  title: string;
  body: string;
  category?: string;
}): Promise<{ thread: CommunityThread }> {
  const data = await apiFetch<{ ok?: boolean; thread?: CommunityThread }>('/api/community/thread', {
    ...communityFetchInit(true),
    method: 'POST',
    body: JSON.stringify(input),
  });
  const thread = data?.thread;
  if (!thread?.id) {
    throw new Error('Thread created but no id returned.');
  }
  return { thread };
}

export async function createCommunityReply(threadId: string, body: string): Promise<void> {
  await apiFetch(`/api/community/thread/${encodeURIComponent(threadId)}/reply`, {
    ...communityFetchInit(true),
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}

export async function editCommunityThread(
  threadId: string,
  input: { title?: string; body?: string },
): Promise<CommunityThread> {
  const data = await apiFetch<{ ok?: boolean; thread?: CommunityThread }>(
    `/api/community/thread/${encodeURIComponent(threadId)}/edit`,
    {
      ...communityFetchInit(true),
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
  if (!data?.thread?.id) throw new Error('Thread edit failed.');
  return data.thread;
}

export async function editCommunityPost(postId: string, body: string): Promise<CommunityPost> {
  const data = await apiFetch<{ ok?: boolean; post?: CommunityPost }>(
    `/api/community/post/${encodeURIComponent(postId)}/edit`,
    {
      ...communityFetchInit(true),
      method: 'POST',
      body: JSON.stringify({ body }),
    },
  );
  if (!data?.post?.id) throw new Error('Post edit failed.');
  return data.post;
}

export async function deleteCommunityThread(threadId: string): Promise<void> {
  await apiFetch(`/api/community/thread/${encodeURIComponent(threadId)}`, {
    ...communityFetchInit(true),
    method: 'DELETE',
  });
}

export async function deleteCommunityPost(postId: string): Promise<void> {
  await apiFetch(`/api/community/post/${encodeURIComponent(postId)}`, {
    ...communityFetchInit(true),
    method: 'DELETE',
  });
}

export async function flagCommunityPost(postId: string, reason: ReportReasonId): Promise<void> {
  await apiFetch(`/api/community/post/${encodeURIComponent(postId)}/flag`, {
    ...communityFetchInit(true),
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function flagCommunityThread(threadId: string, reason: ReportReasonId): Promise<void> {
  await apiFetch(`/api/community/thread/${encodeURIComponent(threadId)}/flag`, {
    ...communityFetchInit(true),
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

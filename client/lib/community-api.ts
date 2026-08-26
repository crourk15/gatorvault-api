import { apiFetch } from './api-fetch';
import { fetchWithWarmPoll } from './api-warm-poll';
import { loadSession } from './auth-api';
import { warmPollProfile } from './warm-poll-profile';
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
  category?: { name?: string; slug?: string } | null;
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
  const params = new URLSearchParams();
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.category) params.set('category', opts.category);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const data = await apiFetch<{ threads?: CommunityThread[] }>(
    `/api/community/threads${qs ? `?${qs}` : ''}`,
    communityFetchInit(),
  );
  return data.threads ?? [];
}

export async function fetchCommunityThread(id: string): Promise<{
  thread: CommunityThread;
  posts: CommunityPost[];
}> {
  const data = await apiFetch<{
    thread?: CommunityThread;
    posts?: CommunityPost[];
    author?: CommunityAuthor | null;
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
  return { thread, posts: data.posts ?? [] };
}

export async function fetchCommunityPulse(): Promise<CommunityPulse> {
  const data = await apiFetch<{ pulse?: CommunityPulse }>('/api/community/pulse', communityFetchInit());
  return data.pulse ?? {};
}

export async function fetchLiveRooms(): Promise<LiveRoom[]> {
  const data = await apiFetch<{ rooms?: LiveRoom[] }>('/api/community/live-rooms', communityFetchInit());
  return data.rooms ?? [];
}

/** Load community hub data with warm-poll while Render wakes. */
export async function fetchCommunityPageData(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<CommunityPageData> {
  return fetchWithWarmPoll(async () => {
    const [categories, threads, pulse, rooms] = await Promise.all([
      fetchCommunityCategories(),
      fetchCommunityThreads(opts),
      fetchCommunityPulse(),
      fetchLiveRooms(),
    ]);
    return { categories, threads, pulse, rooms };
  }, warmPollProfile());
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

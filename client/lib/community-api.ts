import { getApiBase } from './big-board-api';

export type CommunityCategory = {
  id: string;
  slug: string;
  label: string;
  description?: string;
};

export type CommunityThread = {
  id: string;
  title: string;
  body?: string;
  categorySlug?: string;
  categoryLabel?: string;
  authorEmail?: string;
  authorDisplay?: string;
  replyCount?: number;
  viewCount?: number;
  pinned?: boolean;
  featured?: boolean;
  createdAt?: string;
  lastActivityAt?: string;
};

export type CommunityPost = {
  id: string;
  body: string;
  authorDisplay?: string;
  createdAt?: string;
};

export type CommunityPulse = {
  threadCount?: number;
  postCount?: number;
  activeToday?: number;
  topCategory?: string;
};

export type LiveRoom = {
  id: string;
  title: string;
  description?: string;
  scheduledAt?: string;
  status?: string;
};

export async function fetchCommunityCategories(): Promise<CommunityCategory[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/community/categories`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Community categories failed (${res.status})`);
  const data = (await res.json()) as { categories?: CommunityCategory[] };
  return data.categories ?? [];
}

export async function fetchCommunityThreads(opts: {
  sort?: string;
  category?: string;
  limit?: number;
} = {}): Promise<CommunityThread[]> {
  const base = getApiBase();
  const params = new URLSearchParams();
  if (opts.sort) params.set('sort', opts.sort);
  if (opts.category) params.set('category', opts.category);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`${base}/api/community/threads${qs ? `?${qs}` : ''}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Community threads failed (${res.status})`);
  const data = (await res.json()) as { threads?: CommunityThread[] };
  return data.threads ?? [];
}

export async function fetchCommunityThread(id: string): Promise<{
  thread: CommunityThread;
  posts: CommunityPost[];
}> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/community/thread/${encodeURIComponent(id)}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  if (!res.ok) throw new Error(`Thread not found (${res.status})`);
  const data = (await res.json()) as { thread?: CommunityThread; posts?: CommunityPost[] };
  if (!data.thread) throw new Error('Thread not found');
  return { thread: data.thread, posts: data.posts ?? [] };
}

export async function fetchCommunityPulse(): Promise<CommunityPulse> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/community/pulse`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Community pulse failed (${res.status})`);
  const data = (await res.json()) as { pulse?: CommunityPulse };
  return data.pulse ?? {};
}

export async function fetchLiveRooms(): Promise<LiveRoom[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/community/live-rooms`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Live rooms failed (${res.status})`);
  const data = (await res.json()) as { rooms?: LiveRoom[] };
  return data.rooms ?? [];
}

export async function createCommunityThread(input: {
  title: string;
  body: string;
  category?: string;
}): Promise<void> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/community/thread`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Could not post thread (${res.status})`);
  }
}

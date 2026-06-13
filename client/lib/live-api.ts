import { getApiBase } from './big-board-api';

export interface LiveFeedItem {
  id?: string;
  title?: string;
  type?: string;
  source?: string;
  createdAt?: string;
  url?: string;
}

export interface BeatPost {
  handle?: string;
  text?: string;
  publishedAt?: string;
  outlet?: string;
  writerName?: string;
  url?: string;
}

export interface PodcastShow {
  title?: string;
  description?: string;
  platforms?: { name: string; url: string }[];
}

export interface LiveDashboard {
  feed: LiveFeedItem[];
  beat: { posts?: BeatPost[]; error?: string };
  podcasts: { shows?: PodcastShow[] };
  updatedAt?: string;
}

export async function fetchLiveDashboard(limit = 40): Promise<LiveDashboard> {
  const res = await fetch(`${getApiBase()}/api/live/dashboard?limit=${limit}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Live dashboard ${res.status}`);
  const data = (await res.json()) as LiveDashboard & { ok?: boolean };
  return {
    feed: data.feed ?? [],
    beat: data.beat ?? { posts: [] },
    podcasts: data.podcasts ?? { shows: [] },
    updatedAt: data.updatedAt,
  };
}

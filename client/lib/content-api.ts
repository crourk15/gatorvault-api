import { getApiBase } from './big-board-api';

export type PublishedArticle = {
  id: string;
  title: string;
  tier?: string;
  badge?: string;
  badgeClass?: string;
  author?: string;
  date?: string;
  readMin?: number | null;
  excerpt?: string;
  publishedAt?: string | null;
};

export type PublishedStoryline = {
  id: string;
  title: string;
  body?: string;
  excerpt?: string;
};

export type PublishedFeedResponse = {
  ok?: boolean;
  articles: PublishedArticle[];
  storylines: PublishedStoryline[];
};

export async function fetchPublishedFeed(): Promise<PublishedFeedResponse> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/content/published`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Published content failed (${res.status})`);
  const data = (await res.json()) as PublishedFeedResponse;
  return {
    articles: data.articles ?? [],
    storylines: data.storylines ?? [],
  };
}

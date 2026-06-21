import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';

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
  const data = await snapshotFirstFetch('/api/content/published', () =>
    snapshotLiveFetch<PublishedFeedResponse>('/api/content/published')
  );
  return {
    articles: data.articles ?? [],
    storylines: data.storylines ?? [],
  };
}

/**
 * Insider Articles hub API.
 */
import { apiFetch } from './api-fetch';
import { fetchPublishedFeed, type PublishedArticle, type PublishedStoryline } from './content-api';
import {
  categoryFromBadge,
  insiderAuthors,
  insiderHeatIndex,
  insiderStorylinesFallback,
  insiderTags,
  parseStorylineTitle,
  type InsiderAuthor,
  type InsiderHeatRow,
  type InsiderStoryline,
  type InsiderTag,
} from './insider-data';

export type InsiderArticle = {
  id: string;
  category: string;
  title: string;
  preview: string;
  author: string;
  date: string;
  readTime: number;
  trending?: boolean;
};

function mapPublishedArticle(a: PublishedArticle, trending = false): InsiderArticle {
  return {
    id: a.id,
    category: categoryFromBadge(a.badge),
    title: a.title,
    preview: a.excerpt || '',
    author: a.author || 'GatorVault Staff',
    date: a.date || '',
    readTime: a.readMin ?? 5,
    trending,
  };
}

function mapStoryline(s: PublishedStoryline): InsiderStoryline {
  const { icon, title } = parseStorylineTitle(s.title);
  return {
    id: s.id,
    icon,
    title,
    body: String(s.body || s.excerpt || '').replace(/<[^>]+>/g, '').trim(),
  };
}

async function tryInsiderFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

export async function fetchInsiderArticles(): Promise<InsiderArticle[]> {
  const remote = await tryInsiderFetch<InsiderArticle[]>('/api/insider/articles');
  if (remote?.length) return remote;
  const feed = await fetchPublishedFeed();
  return feed.articles.map((a, i) => mapPublishedArticle(a, i < 2));
}

export async function fetchInsiderFeatured(): Promise<InsiderArticle | null> {
  const remote = await tryInsiderFetch<InsiderArticle>('/api/insider/featured');
  if (remote?.id) return remote;
  const articles = await fetchInsiderArticles();
  return articles[0] ?? null;
}

export async function fetchInsiderStorylines(): Promise<InsiderStoryline[]> {
  const remote = await tryInsiderFetch<InsiderStoryline[]>('/api/insider/storylines');
  if (remote?.length) return remote;
  const feed = await fetchPublishedFeed();
  if (feed.storylines?.length) return feed.storylines.map(mapStoryline);
  return insiderStorylinesFallback;
}

export async function fetchInsiderAuthors(): Promise<InsiderAuthor[]> {
  const remote = await tryInsiderFetch<InsiderAuthor[]>('/api/insider/authors');
  return remote?.length ? remote : insiderAuthors;
}

export async function fetchInsiderHeatIndex(): Promise<InsiderHeatRow[]> {
  const remote = await tryInsiderFetch<InsiderHeatRow[]>('/api/insider/heat-index');
  return remote?.length ? remote : insiderHeatIndex;
}

export async function fetchInsiderTags(): Promise<InsiderTag[]> {
  const remote = await tryInsiderFetch<InsiderTag[]>('/api/insider/tags');
  return remote?.length ? remote : insiderTags;
}

export async function fetchInsiderRelated(articleId: string): Promise<InsiderArticle[]> {
  const remote = await tryInsiderFetch<{ related?: InsiderArticle[] }>(`/api/insider/articles/${articleId}/related`);
  if (remote?.related?.length) return remote.related;
  const articles = await fetchInsiderArticles();
  const current = articles.find((a) => a.id === articleId);
  if (!current) return [];
  return articles.filter((a) => a.id !== articleId && a.category === current.category).slice(0, 4);
}

export async function fetchInsiderHubBundle(): Promise<{
  articles: InsiderArticle[];
  featured: InsiderArticle | null;
  storylines: InsiderStoryline[];
  authors: InsiderAuthor[];
  heatIndex: InsiderHeatRow[];
  tags: InsiderTag[];
}> {
  const [articles, storylines, authors, heatIndex, tags] = await Promise.all([
    fetchInsiderArticles(),
    fetchInsiderStorylines(),
    fetchInsiderAuthors(),
    fetchInsiderHeatIndex(),
    fetchInsiderTags(),
  ]);
  return {
    articles,
    featured: articles[0] ?? null,
    storylines,
    authors,
    heatIndex,
    tags,
  };
}

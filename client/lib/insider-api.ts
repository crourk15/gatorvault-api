/**
 * Insider Articles hub API.
 */
import { apiFetch } from './api-fetch';
import { fetchPublishedFeed, type PublishedArticle, type PublishedStoryline } from './content-api';
import {
  AUTHOR_ROLE_BY_NAME,
  categoryFromBadge,
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


function slugPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function deriveAuthorsFromArticles(articles: InsiderArticle[]): InsiderAuthor[] {
  const counts = new Map<string, InsiderAuthor>();
  for (const a of articles) {
    const name = (a.author || 'GatorVault Staff').trim() || 'GatorVault Staff';
    const key = name.toLowerCase();
    const prev = counts.get(key);
    if (prev) prev.articleCount += 1;
    else {
      counts.set(key, {
        id: `author-${slugPart(name)}`,
        name,
        role: AUTHOR_ROLE_BY_NAME[key] || 'GatorVault Insider',
        articleCount: 1,
      });
    }
  }
  return [...counts.values()].sort(
    (a, b) => b.articleCount - a.articleCount || a.name.localeCompare(b.name)
  );
}

function articleTagHaystack(a: InsiderArticle): string {
  return [a.title, a.preview, a.category, a.author].filter(Boolean).join(' ');
}

export function deriveTagsFromArticles(articles: InsiderArticle[]): InsiderTag[] {
  const out: InsiderTag[] = [];
  for (const tag of insiderTags) {
    const re = tag.match;
    if (!re) continue;
    let n = 0;
    for (const a of articles) {
      if (re.test(articleTagHaystack(a))) n += 1;
    }
    if (n < 1) continue;
    out.push({ id: tag.id, label: tag.label, hot: Boolean(tag.hot) || n >= 2 });
  }
  const knownCats = new Set([
    'recruiting',
    'film room',
    'game week',
    'roster',
    'nil',
    'community',
  ]);
  const covered = new Set(out.map((t) => t.label.toLowerCase()));
  const catCounts = new Map<string, number>();
  for (const a of articles) {
    const label = (a.category || '').trim();
    if (!label || !knownCats.has(label.toLowerCase())) continue;
    if (covered.has(label.toLowerCase())) continue;
    catCounts.set(label, (catCounts.get(label) || 0) + 1);
  }
  for (const [label, n] of [...catCounts.entries()].sort((a, b) => b[1] - a[1])) {
    out.push({
      id: `tag-cat-${slugPart(label)}`,
      label,
      hot: n >= 2,
    });
  }
  return out.slice(0, 12);
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
  if (remote?.length) return remote;
  const articles = await fetchInsiderArticles();
  return deriveAuthorsFromArticles(articles);
}

export async function fetchInsiderHeatIndex(): Promise<InsiderHeatRow[]> {
  const remote = await tryInsiderFetch<InsiderHeatRow[]>('/api/insider/heat-index');
  return remote?.length ? remote : insiderHeatIndex;
}

export async function fetchInsiderTags(): Promise<InsiderTag[]> {
  const remote = await tryInsiderFetch<InsiderTag[]>('/api/insider/tags');
  if (remote?.length) return remote;
  const articles = await fetchInsiderArticles();
  return deriveTagsFromArticles(articles);
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
  const [articles, storylines, heatIndex] = await Promise.all([
    fetchInsiderArticles(),
    fetchInsiderStorylines(),
    fetchInsiderHeatIndex(),
  ]);
  // Always derive from the article list so counts/chips stay honest even if
  // a stale API still returns seed author/tag catalogs.
  return {
    articles,
    featured: articles[0] ?? null,
    storylines,
    authors: deriveAuthorsFromArticles(articles),
    heatIndex,
    tags: deriveTagsFromArticles(articles),
  };
}

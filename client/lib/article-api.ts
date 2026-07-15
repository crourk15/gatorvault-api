/**
 * Full article detail   content feed first, insider engine fallback.
 */
import { snapshotFirstFetch, snapshotLiveFetch } from './snapshot-fetch';

export type ArticleSource = {
  reporter?: string;
  name?: string;
  outlet?: string;
  label?: string;
  url?: string;
  href?: string;
};

export type ArticleDetail = {
  id: string;
  title: string;
  tier?: string;
  badge?: string;
  badgeClass?: string;
  author?: string;
  date?: string;
  readMin?: number | null;
  excerpt?: string;
  body?: string;
  takeaways?: string[];
  sources?: ArticleSource[];
  category?: string;
  categoryLabel?: string;
  articleType?: string;
  publishedAt?: string | null;
  slug?: string;
  recruitingTargets?: string[];
  rosterUnits?: string[];
  schemeTags?: string[];
  analyticsTags?: string[];
  insiderEngine?: boolean;
};

type ArticleEnvelope = { ok?: boolean; article?: ArticleDetail; error?: string };

async function fetchContentArticle(id: string): Promise<ArticleDetail | null> {
  try {
    const data = await snapshotFirstFetch(`/api/content/articles/${encodeURIComponent(id)}`, () =>
      snapshotLiveFetch<ArticleEnvelope>(`/api/content/articles/${encodeURIComponent(id)}`)
    );
    if (data?.ok && data.article?.id) return data.article;
  } catch {
    /* fall through */
  }
  return null;
}

async function fetchEngineArticle(id: string): Promise<ArticleDetail | null> {
  try {
    const data = await snapshotFirstFetch(`/api/articles/${encodeURIComponent(id)}`, () =>
      snapshotLiveFetch<ArticleEnvelope>(`/api/articles/${encodeURIComponent(id)}`)
    );
    if (data?.ok && data.article?.id) return data.article;
  } catch {
    /* fall through */
  }
  return null;
}

export async function fetchArticleById(id: string): Promise<ArticleDetail | null> {
  if (!id) return null;
  const fromContent = await fetchContentArticle(id);
  if (fromContent) return fromContent;
  return fetchEngineArticle(id);
}

/** Strip HTML for teaser / share text. */
export function articlePlainText(html: string | undefined, maxLen = 280): string {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trim()}& `;
}

export function articleNeedsInsider(tier: string | undefined): boolean {
  const t = String(tier || 'locker').toLowerCase();
  return t === 'insider' || t === 'film' || t === 'war';
}

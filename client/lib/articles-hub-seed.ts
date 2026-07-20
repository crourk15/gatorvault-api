import seedJson from './articles-hub-seed.json';
import type { InsiderArticle } from './insider-api';
import type { InsiderAuthor, InsiderHeatRow, InsiderStoryline, InsiderTag } from './insider-data';

export type ArticlesHubSeed = {
  generatedAt: string;
  source: string;
  articles: InsiderArticle[];
  featured: InsiderArticle | null;
  storylines: InsiderStoryline[];
  authors: InsiderAuthor[];
  heatIndex: InsiderHeatRow[];
  tags: InsiderTag[];
};

export const ARTICLES_HUB_SEED = seedJson as ArticlesHubSeed;

export function buildSeedArticlesHub() {
  const articles = Array.isArray(ARTICLES_HUB_SEED.articles) ? ARTICLES_HUB_SEED.articles : [];
  return {
    articles,
    featured: ARTICLES_HUB_SEED.featured || articles[0] || null,
    storylines: Array.isArray(ARTICLES_HUB_SEED.storylines) ? ARTICLES_HUB_SEED.storylines : [],
    authors: Array.isArray(ARTICLES_HUB_SEED.authors) ? ARTICLES_HUB_SEED.authors : [],
    heatIndex: Array.isArray(ARTICLES_HUB_SEED.heatIndex) ? ARTICLES_HUB_SEED.heatIndex : [],
    tags: Array.isArray(ARTICLES_HUB_SEED.tags) ? ARTICLES_HUB_SEED.tags : [],
  };
}

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '@/lib/insider-hub.css';
import {
  fetchInsiderHubBundle,
  fetchInsiderRelated,
  type InsiderArticle,
} from '@/lib/insider-api';
import {
  insiderCategories,
  type InsiderAuthor,
  type InsiderHeatRow,
  type InsiderStoryline,
  type InsiderTag,
} from '@/lib/insider-data';
import { articleRoute } from '@/lib/site-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

function InsiderHero(): React.ReactElement {
  return (
    <header className="insider-hero" data-testid="insider-hero">
      <div className="insider-hero__inner">
        <h1 className="insider-hero-title">Insider Articles</h1>
        <p className="insider-hero-subtitle">
          Film breakdowns, coaching intel, and roster analysis for members who want more than
          surface-level takes. Your premium Florida Gators football newsroom inside the Vault.
        </p>
        <div className="insider-hero-underline" aria-hidden />
      </div>
    </header>
  );
}

function RelatedArticlesSection({ articles }: { articles: InsiderArticle[] }): React.ReactElement | null {
  if (!articles.length) return null;
  return (
    <section className="insider-section" data-testid="insider-related">
      <h2 className="insider-section-title">Related Articles</h2>
      <div className="insider-article-grid">
        {articles.map((article) => (
          <a key={article.id} href={articleRoute(article.id)} className="insider-article-card">
            <span className="insider-article-category">{article.category}</span>
            <h3 className="insider-article-title">{article.title}</h3>
            <p className="insider-article-preview">{article.preview}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function FeaturedInsiderArticle({ article }: { article: InsiderArticle }): React.ReactElement {
  return (
    <article className="insider-card" data-testid="insider-featured">
      <div className="insider-featured-header">
        <span className="insider-badge-featured">Featured</span>
        <span className="insider-featured-cat">{article.category}</span>
      </div>
      <h2 className="insider-featured-title">{article.title}</h2>
      <p className="insider-featured-subtitle">{article.preview}</p>
      <p className="insider-featured-meta">
        {article.author} · {article.date} · {article.readTime} min read
      </p>
      <a className="insider-button-primary" href={articleRoute(article.id)}>
        Read now <span aria-hidden>→</span>
      </a>
    </article>
  );
}

function StorylineWidget({ storylines }: { storylines: InsiderStoryline[] }): React.ReactElement {
  const [flipped, setFlipped] = useState<string | null>(null);

  return (
    <div className="insider-card" data-testid="insider-storylines">
      <h2 className="insider-section-title">Season Storylines</h2>
      <div className="insider-storylines">
        {storylines.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`insider-storyline-card${flipped === s.id ? ' is-flipped' : ''}`}
            onClick={() => setFlipped((prev) => (prev === s.id ? null : s.id))}
          >
            <div className="insider-storyline-inner">
              <div className="insider-storyline-face">
                <h3 className="insider-storyline-title">
                  <span className="insider-storyline-icon" aria-hidden>
                    {s.icon}
                  </span>{' '}
                  {s.title}
                </h3>
                <p className="insider-storyline-body">Tap to flip for intel</p>
              </div>
              <div className="insider-storyline-face insider-storyline-face--back">
                <p className="insider-storyline-body">{s.body}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function InsiderCategories({
  active,
  onChange,
}: {
  active: string;
  onChange: (name: string) => void;
}): React.ReactElement {
  return (
    <div className="insider-categories" role="tablist" aria-label="Article categories">
      {insiderCategories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          role="tab"
          aria-selected={cat.name === active}
          className={`insider-category-tab${cat.name === active ? ' insider-category-tab--active' : ''}`}
          onClick={() => onChange(cat.name)}
        >
          <span className="insider-category-tab__icon" aria-hidden>
            {cat.icon}
          </span>
          <span>{cat.name}</span>
        </button>
      ))}
    </div>
  );
}

function InsiderSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.ReactElement {
  return (
    <div className="insider-search">
      <input
        className="insider-search-input"
        placeholder="Search Insider articles (QB battle, portal, 3-3-5)…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search Insider articles"
      />
    </div>
  );
}

function InsiderArticleGrid({ articles }: { articles: InsiderArticle[] }): React.ReactElement {
  if (!articles.length) {
    return <UiEmpty message="No articles match your filters." />;
  }
  return (
    <div className="insider-article-grid" data-testid="insider-article-grid">
      {articles.map((article) => (
        <a key={article.id} href={articleRoute(article.id)} className="insider-article-card">
          <div className="insider-article-card__top">
            <span className="insider-article-category">{article.category}</span>
            <div className="insider-article-actions">
              {article.trending ? (
                <span className="insider-article-trending" title="Trending" aria-label="Trending">
                  🔥
                </span>
              ) : null}
              <span className="insider-article-bookmark" aria-hidden>
                ★
              </span>
            </div>
          </div>
          <h3 className="insider-article-title">{article.title}</h3>
          <p className="insider-article-preview">{article.preview}</p>
          <div className="insider-article-meta">
            <span>
              {article.author} · {article.date}
            </span>
            <span className="insider-article-read">{article.readTime} min</span>
          </div>
        </a>
      ))}
    </div>
  );
}

function InsiderAuthors({ authors }: { authors: InsiderAuthor[] }): React.ReactElement {
  return (
    <div className="insider-card" data-testid="insider-authors">
      <h2 className="insider-section-title">Authors</h2>
      <div className="insider-authors-grid">
        {authors.map((author) => (
          <div key={author.id} className="insider-author-card">
            <div className="insider-author-avatar" aria-hidden>
              {author.name.charAt(0)}
            </div>
            <div>
              <div className="insider-author-name">{author.name}</div>
              <div className="insider-author-role">{author.role}</div>
              <div className="insider-author-count">{author.articleCount} articles</div>
            </div>
          </div>
        ))}
      </div>
      <a className="insider-view-all" href="/articles">
        View all articles →
      </a>
    </div>
  );
}

function InsiderHeatIndexWidget({ data }: { data: InsiderHeatRow[] }): React.ReactElement {
  return (
    <div className="insider-heat-index" data-testid="insider-heat-index">
      <h2 className="insider-section-title">Insider Heat Index</h2>
      {data.map((row) => (
        <div key={row.id} className="insider-heat-row">
          <div className="insider-heat-label">{row.label}</div>
          <div className="insider-heat-bar">
            <div className="insider-heat-fill" style={{ width: `${row.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsiderTrendingTimeline({ articles }: { articles: InsiderArticle[] }): React.ReactElement {
  const nodes = articles.slice(0, 4);
  return (
    <div className="insider-card" data-testid="insider-timeline">
      <h2 className="insider-section-title">Insider Trending Timeline</h2>
      <ul className="insider-timeline">
        {nodes.map((a, i) => (
          <li
            key={a.id}
            className={`insider-timeline-item${i === 0 ? ' insider-timeline-item--active' : ''}`}
          >
            <p className="insider-timeline-label">{a.title}</p>
            <p className="insider-timeline-sub">
              {a.date} · {a.readTime} min
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InsiderSpotlightCarousel({ articles }: { articles: InsiderArticle[] }): React.ReactElement {
  const spotlight = articles.slice(0, 5);
  if (!spotlight.length) return <></>;
  return (
    <div className="insider-card" data-testid="insider-spotlight">
      <h2 className="insider-section-title">Insider Spotlight</h2>
      <div className="insider-spotlight">
        {spotlight.map((a) => (
          <a key={a.id} href={articleRoute(a.id)} className="insider-spotlight-card">
            <p className="insider-spotlight-card__title">{a.title}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function InsiderTagCloud({
  tags,
  onTagClick,
}: {
  tags: InsiderTag[];
  onTagClick: (label: string) => void;
}): React.ReactElement {
  return (
    <div className="insider-card" data-testid="insider-tags">
      <h2 className="insider-section-title">Insider Tags</h2>
      <div className="insider-tag-cloud">
        {tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`insider-tag${tag.hot ? ' insider-tag--hot' : ''}`}
            onClick={() => onTagClick(tag.label)}
          >
            {tag.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface InsiderArticlesPageProps {
  initialArticleId?: string;
}

export function InsiderArticlesPage({
  initialArticleId,
}: InsiderArticlesPageProps = {}): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<InsiderArticle[]>([]);
  const [featured, setFeatured] = useState<InsiderArticle | null>(null);
  const [storylines, setStorylines] = useState<InsiderStoryline[]>([]);
  const [authors, setAuthors] = useState<InsiderAuthor[]>([]);
  const [heatIndex, setHeatIndex] = useState<InsiderHeatRow[]>([]);
  const [tags, setTags] = useState<InsiderTag[]>([]);
  const [related, setRelated] = useState<InsiderArticle[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bundle = await fetchInsiderHubBundle();
      setArticles(bundle.articles);
      const feat =
        (initialArticleId
          ? bundle.articles.find((a) => a.id === initialArticleId)
          : null) ??
        bundle.featured;
      setFeatured(feat);
      setStorylines(bundle.storylines);
      setAuthors(bundle.authors);
      setHeatIndex(bundle.heatIndex);
      setTags(bundle.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Insider articles.');
    } finally {
      setLoading(false);
    }
  }, [initialArticleId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!featured?.id) {
      setRelated([]);
      return;
    }
    fetchInsiderRelated(featured.id).then(setRelated).catch(() => setRelated([]));
  }, [featured?.id]);

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return articles.filter((article) => {
      const matchesCategory =
        activeCategory === 'All' || article.category === activeCategory;
      const matchesSearch =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.preview.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [articles, activeCategory, searchQuery]);

  const listArticles = useMemo(() => {
    if (!featured) return filteredArticles;
    return filteredArticles.filter((a) => a.id !== featured.id);
  }, [filteredArticles, featured]);

  const handleTagClick = useCallback((label: string) => {
    setSearchQuery(label);
    setActiveCategory('All');
  }, []);

  if (loading) {
    return (
      <div className="insider-page" data-testid="insider-articles-page">
        <div className="insider-page__frame">
          <p className="insider-status">Loading Insider articles…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insider-page" data-testid="insider-articles-page">
        <div className="insider-page__frame">
          <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
        </div>
      </div>
    );
  }

  return (
    <div className="insider-page" data-testid="insider-articles-page">
      <div className="insider-page__frame">
        <InsiderHero />

        <div className="insider-grid">
          <div>
            {featured ? (
              <section className="insider-section">
                <FeaturedInsiderArticle article={featured} />
              </section>
            ) : null}

            <RelatedArticlesSection articles={related} />

            {storylines.length > 0 ? (
              <section className="insider-section">
                <StorylineWidget storylines={storylines} />
              </section>
            ) : null}

            <section className="insider-section">
              <InsiderCategories active={activeCategory} onChange={setActiveCategory} />
              <InsiderSearch value={searchQuery} onChange={setSearchQuery} />
              <InsiderArticleGrid articles={listArticles} />
            </section>
          </div>

          <aside>
            <section className="insider-section">
              <InsiderHeatIndexWidget data={heatIndex} />
            </section>
            <section className="insider-section">
              <InsiderTrendingTimeline articles={articles} />
            </section>
            <section className="insider-section">
              <InsiderSpotlightCarousel articles={articles} />
            </section>
            <section className="insider-section">
              <InsiderAuthors authors={authors} />
            </section>
            <section className="insider-section">
              <InsiderTagCloud tags={tags} onTagClick={handleTagClick} />
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default InsiderArticlesPage;

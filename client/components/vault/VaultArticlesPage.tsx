'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchPublishedFeed, type PublishedArticle, type PublishedStoryline } from '@/lib/content-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

function ArticleCard({ article }: { article: PublishedArticle }): React.ReactElement {
  return (
    <a href={`/article/${encodeURIComponent(article.id)}`} className="gv-article-card">
      <div className="gv-article-card__meta">
        {article.badge ? <span className="gv-article-card__badge">{article.badge}</span> : null}
        {article.readMin ? <span className="gv-article-card__read">{article.readMin} min read</span> : null}
      </div>
      <h2 className="gv-article-card__title">{article.title}</h2>
      {article.excerpt ? <p className="gv-article-card__excerpt">{article.excerpt}</p> : null}
      <p className="gv-article-card__byline">
        {article.author || 'GatorVault Staff'}
        {article.date ? ` · ${article.date}` : ''}
      </p>
    </a>
  );
}

export function VaultArticlesPage(): React.ReactElement {
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [storylines, setStorylines] = useState<PublishedStoryline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const feed = await fetchPublishedFeed();
      setArticles(feed.articles);
      setStorylines(feed.storylines);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load articles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="gv-articles" data-testid="vault-articles">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Insider Articles</h1>
        <p className="gv-page-subtitle">
          Film breakdowns, coaching intel, and roster analysis written for members who want more than
          surface-level takes.
        </p>
      </div>

      {loading && <p className="gv-page-status">Loading articles…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && storylines.length > 0 && (
        <section className="gv-articles__storylines">
          <h2 className="gv-vault-alerts__section-title">Season Storylines</h2>
          <ul className="gv-storyline-list">
            {storylines.map((s) => (
              <li key={s.id} className="gv-storyline-item">
                <strong>{s.title}</strong>
                {s.excerpt || s.body ? (
                  <p>{String(s.excerpt || s.body).replace(/<[^>]+>/g, '').slice(0, 180)}…</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && (
        <section className="gv-articles__feed">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
          {articles.length === 0 && (
            <UiEmpty message="No published articles yet." hint="Check /api/content/published on the API." />
          )}
        </section>
      )}
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Card, Chip, GridLayout, PageLayout, PageSection } from '@/components/brand';
import { fetchPublishedFeed, type PublishedArticle, type PublishedStoryline } from '@/lib/content-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const CATEGORIES = ['Recruiting', 'Film Room', 'Game Week', 'Roster', 'NIL', 'Community'];

const AUTHORS = [
  { name: 'GatorVault Staff', role: 'Editorial', articles: 48 },
  { name: 'GatorVault Film Desk', role: 'Film Analysis', articles: 32 },
  { name: 'GatorVault Analytics', role: 'Data & Trends', articles: 21 },
];

function ArticleCard({ article }: { article: PublishedArticle }): React.ReactElement {
  return (
    <Card href={`/article/${encodeURIComponent(article.id)}`} className="gv-article-card">
      <div className="gv-article-card__meta">
        {article.badge ? <Chip variant="blue">{article.badge}</Chip> : null}
        {article.readMin ? <span className="gv-article-card__read">{article.readMin} min read</span> : null}
      </div>
      <h2 className="gv-article-card__title">{article.title}</h2>
      {article.excerpt ? <p className="gv-article-card__excerpt">{article.excerpt}</p> : null}
      <p className="gv-article-card__byline">
        {article.author || 'GatorVault Staff'}
        {article.date ? ` · ${article.date}` : ''}
      </p>
    </Card>
  );
}

export function VaultArticlesPage(): React.ReactElement {
  const [articles, setArticles] = useState<PublishedArticle[]>([]);
  const [storylines, setStorylines] = useState<PublishedStoryline[]>([]);
  const [category, setCategory] = useState('');
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

  const featured = articles[0];
  const filtered = category
    ? articles.filter((a) => (a.badge || '').toLowerCase().includes(category.toLowerCase()))
    : articles.slice(featured ? 1 : 0);

  return (
    <PageLayout
      theme="white"
      title="Insider Articles"
      subtitle="Film breakdowns, coaching intel, and roster analysis for members who want more than surface-level takes."
      testId="vault-articles"
    >
      {loading && <p className="gv-page-status">Loading articles…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && featured && (
        <PageSection title="Featured Article">
          <Card variant="accent" href={`/article/${encodeURIComponent(featured.id)}`} className="gv-articles__featured">
            <Chip variant="orange">Featured</Chip>
            <h2 className="gv-type-h2" style={{ margin: '0.75rem 0' }}>{featured.title}</h2>
            {featured.excerpt ? <p>{featured.excerpt}</p> : null}
            <p style={{ opacity: 0.7, margin: 0 }}>
              {featured.author || 'GatorVault Staff'}
              {featured.date ? ` · ${featured.date}` : ''}
            </p>
          </Card>
        </PageSection>
      )}

      {!loading && !error && storylines.length > 0 && (
        <PageSection title="Season Storylines">
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
        </PageSection>
      )}

      {!loading && !error && (
        <>
          <PageSection title="Categories">
            <div className="gv-ds-filters">
              <button
                type="button"
                className={`gv-ds-filter${!category ? ' is-active' : ''}`}
                onClick={() => setCategory('')}
              >
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`gv-ds-filter${category === c ? ' is-active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </PageSection>

          <PageSection title="Latest Articles">
            <section className="gv-articles__feed">
              {filtered.map((a) => (
                <ArticleCard key={a.id} article={a} />
              ))}
              {filtered.length === 0 && articles.length === 0 && (
                <UiEmpty message="No published articles yet." hint="Check /api/content/published on the API." />
              )}
            </section>
          </PageSection>

          <PageSection title="Authors">
            <GridLayout cols={3}>
              {AUTHORS.map((author) => (
                <Card key={author.name}>
                  <h3 className="gv-type-h3" style={{ margin: 0 }}>{author.name}</h3>
                  <Chip variant="blue">{author.role}</Chip>
                  <p style={{ margin: '0.5rem 0 0', opacity: 0.75 }}>{author.articles} articles</p>
                </Card>
              ))}
            </GridLayout>
          </PageSection>
        </>
      )}
    </PageLayout>
  );
}

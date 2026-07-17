'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  articleNeedsInsider,
  articlePlainText,
  fetchArticleById,
  type ArticleDetail,
  type ArticleSource,
} from '@/lib/article-api';
import { fetchInsiderRelated, type InsiderArticle } from '@/lib/insider-api';
import { articleRoute, SITE_ROUTES } from '@/lib/site-routes';
import { vaultArticleRoute } from '@/lib/vault-route-map';
import { useUser } from '@/lib/useUser';
import { ArticleAccessGate } from '@/components/articles/ArticleAccessGate';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';
import { UiWarming, UiError } from '@/components/site/UiMessage';
import '@/lib/article-reader.css';

type Props = {
  articleId: string;
  listHref?: string;
  listLabel?: string;
};

function relatedArticleHref(articleId: string, listHref: string): string {
  return listHref.startsWith('/vault') ? vaultArticleRoute(articleId) : articleRoute(articleId);
}

function stripTakeaway(text: string): string {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceLabel(s: ArticleSource): string {
  const who = s.reporter || s.name || '';
  const outlet = s.outlet || s.label || '';
  if (who && outlet) return `${who} · ${outlet}`;
  return who || outlet || 'Source';
}

function collectTags(article: ArticleDetail): { label: string; href?: string }[] {
  const tags: { label: string; href?: string }[] = [];
  for (const t of article.recruitingTargets || []) {
    const name = String(t).trim();
    if (!name) continue;
    tags.push({ label: name, href: `${SITE_ROUTES.recruiting}?q=${encodeURIComponent(name)}` });
  }
  for (const t of article.schemeTags || []) {
    const name = String(t).trim();
    if (name) tags.push({ label: name });
  }
  for (const t of article.analyticsTags || []) {
    const name = String(t).trim();
    if (name) tags.push({ label: name });
  }
  for (const t of article.rosterUnits || []) {
    const name = String(t).trim();
    if (name) tags.push({ label: name, href: `${SITE_ROUTES.team}#roster` });
  }
  return tags.slice(0, 12);
}

export function ArticleReader({
  articleId,
  listHref = SITE_ROUTES.articles,
  listLabel = '← All articles',
}: Props): React.ReactElement {
  const isDesktop = useIsCommandCenterDesktop();
  const { user, isInsider, ready } = useUser();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [related, setRelated] = useState<InsiderArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchArticleById(articleId);
      if (!data) {
        setArticle(null);
        setError('Article not found.');
        return;
      }
      setArticle(data);
      const rel = await fetchInsiderRelated(articleId).catch(() => []);
      setRelated(rel.slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article.');
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isMember = Boolean(user?.email);
  const needsInsider = articleNeedsInsider(article?.tier);
  const canReadFull = needsInsider ? isInsider : isMember;

  const metaLine = useMemo(() => {
    if (!article) return '';
    const parts: string[] = [];
    if (article.author) parts.push(`By ${article.author}`);
    if (article.date) parts.push(article.date);
    if (article.readMin) parts.push(`${article.readMin} min read`);
    return parts.join(' · ');
  }, [article]);

  const tags = useMemo(() => (article ? collectTags(article) : []), [article]);

  const teaserBody = useMemo(() => {
    if (!article) return null;
    const plain = article.excerpt || articlePlainText(article.body, 420);
    return (
      <div className="gv-article-page__panel">
        <p className="gv-article-page__panel-label">Member preview</p>
        <p className="gv-article-body" style={{ margin: 0 }}>
          {plain}
        </p>
      </div>
    );
  }, [article]);

  const onShare = useCallback(async () => {
    if (!article || typeof window === 'undefined') return;
    const url = `${window.location.origin}${articleRoute(article.id)}`;
    const payload = { title: article.title, text: article.excerpt || article.title, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        setShareNote('Shared');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setShareNote('Link copied');
      } else {
        setShareNote(url);
      }
    } catch {
      /* user cancelled */
    }
    window.setTimeout(() => setShareNote(null), 2500);
  }, [article]);

  return (
    <div className="rh-page rh-page--elite gv-article-shell mobile-app gv-page" data-testid="vault-article-reader">
      {!isDesktop ? (
        <header className="rh-elite-mobile-header" aria-label="Article">
          <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
          <h1 className="rh-elite-mobile-header__title">Insider Articles</h1>
          <p className="rh-elite-mobile-header__sub">Original Gators analysis.</p>
        </header>
      ) : null}

      <article className="gv-article-page">
        <a className="gv-article-page__back" href={listHref}>
          {listLabel}
        </a>

        {loading || !ready ? (
          <div className="gv-article-page__loading">
            <UiWarming hint="Loading article…" />
          </div>
        ) : null}

        {!loading && error ? (
          <div className="gv-article-page__error">
            <UiError title="Article unavailable" message={error} retry={() => void load()} />
          </div>
        ) : null}

        {!loading && article ? (
          <>
            <span className="gv-article-page__badge">{article.badge || article.categoryLabel || 'Article'}</span>
            <h1 className="gv-article-page__title">{article.title}</h1>
            {metaLine ? <p className="gv-article-page__meta">{metaLine}</p> : null}
            {article.excerpt ? <p className="gv-article-page__excerpt">{article.excerpt}</p> : null}

            <div className="gv-article-page__actions">
              <button type="button" className="gv-article-page__action" onClick={() => void onShare()}>
                Share
              </button>
              {shareNote ? <span className="gv-article-page__meta">{shareNote}</span> : null}
            </div>

            {tags.length ? (
              <div className="gv-article-page__tags" aria-label="Related topics">
                {tags.map((tag) =>
                  tag.href ? (
                    <a key={tag.label} className="gv-article-page__tag" href={tag.href}>
                      {tag.label}
                    </a>
                  ) : (
                    <span key={tag.label} className="gv-article-page__tag">
                      {tag.label}
                    </span>
                  )
                )}
              </div>
            ) : null}

            <ArticleAccessGate canReadFull={canReadFull} needsInsider={needsInsider} teaser={teaserBody}>
              <>
                {article.body ? (
                  <div
                    className="gv-article-page__panel gv-article-body"
                    dangerouslySetInnerHTML={{ __html: article.body }}
                  />
                ) : null}

                {article.takeaways && article.takeaways.length > 0 ? (
                  <div className="gv-article-page__panel">
                    <p className="gv-article-page__panel-label">Key takeaways</p>
                    <ul className="gv-article-takeaways">
                      {article.takeaways.map((item) => (
                        <li key={stripTakeaway(item)}>{stripTakeaway(item)}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {article.sources && article.sources.length > 0 ? (
                  <div className="gv-article-page__panel">
                    <p className="gv-article-page__panel-label">Verified sources</p>
                    <ul className="gv-article-sources">
                      {article.sources.map((s, i) => {
                        const url = s.url || s.href;
                        const label = sourceLabel(s);
                        return (
                          <li key={`${label}-${i}`}>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                {label}
                              </a>
                            ) : (
                              label
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="gv-article-page__footnote">
                      Original GatorVault analysis based on public beat and recruiting reporting.
                    </p>
                  </div>
                ) : null}
              </>
            </ArticleAccessGate>

            {related.length > 0 ? (
              <section className="gv-article-page__related" aria-label="Related articles">
                <h2 className="gv-article-page__related-title">Related</h2>
                <ul className="gv-article-page__related-list">
                  {related.map((item) => (
                    <li key={item.id}>
                      <a href={relatedArticleHref(item.id, listHref)}>
                        {item.title}
                        <span>
                          {item.category}
                          {item.readTime ? ` · ${item.readTime} min` : ''}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}
      </article>
    </div>
  );
}
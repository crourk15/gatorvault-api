'use client';

import React from 'react';
import type { ContentLatestResponse } from '@/lib/vault-home-api';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { articleRoute, SITE_ROUTES } from '@/lib/site-routes';

const VAULT_ARTICLES = SITE_ROUTES.articles;
const VAULT_COMMUNITY = '/vault/community';

type Props = {
  content: ContentLatestResponse | null;
  loading?: boolean;
};

function formatMeta(timestamp?: string | null): string {
  if (!timestamp) return 'Recently';
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type ColumnProps = {
  heading: string;
  items: { title: string; href: string; meta?: string }[];
  empty: string;
};

function ContentColumn({ heading, items, empty }: ColumnProps): React.ReactElement {
  return (
    <article className="uf-premium-card">
      <h3 className="uf-premium-card__title">{heading}</h3>
      <ul className="uf-premium-card__list">
        {items.length === 0 ? (
          <li>
            <span className="uf-premium-empty">{empty}</span>
          </li>
        ) : (
          items.slice(0, 3).map((item) => (
            <li key={`${heading}_${item.href}`}>
              <a href={item.href}>{item.title}</a>
              {item.meta ? (
                <span className="uf-premium-card__body" style={{ display: 'block', marginTop: 4 }}>
                  {item.meta}
                </span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </article>
  );
}

export function HomeContentPreview({ content, loading }: Props): React.ReactElement {
  if (loading && !content) {
    return (
      <div className="uf-premium-grid uf-premium-grid--content">
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
      </div>
    );
  }

  const articles =
    content?.articles?.slice(0, 3).map((a) => ({
      title: a.title,
      href: a.href && !String(a.href).includes('#') ? a.href : (a.id ? articleRoute(a.id) : VAULT_ARTICLES),
      meta: formatMeta(a.timestamp),
    })) ?? [];

  const community =
    content?.community?.slice(0, 3).map((t) => ({
      title: t.title,
      href: t.href || VAULT_COMMUNITY,
      meta: t.replyCount != null ? `${t.replyCount} replies` : formatMeta(t.timestamp),
    })) ?? [];

  const filmRoom =
    content?.filmRoom?.slice(0, 3).map((f) => ({
      title: f.title,
      href: f.href || VAULT_PILLAR_ROUTES.filmRoom,
      meta: formatMeta(f.timestamp),
    })) ?? [];

  return (
    <div className="uf-premium-grid uf-premium-grid--content" data-testid="home-content-preview">
      <ContentColumn heading="Latest Articles" items={articles} empty="No articles yet." />
      <ContentColumn heading="Latest Community Posts" items={community} empty="No threads yet." />
      <ContentColumn
        heading="Latest Film Room Breakdowns"
        items={filmRoom}
        empty="Film room clips coming soon."
      />
    </div>
  );
}

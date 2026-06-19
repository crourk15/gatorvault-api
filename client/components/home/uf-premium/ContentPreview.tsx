'use client';

import React from 'react';
import type { ContentLatestResponse } from '@/lib/vault-home-api';
import { UfPremiumCard, UfPremiumSection } from './primitives';

type Props = {
  content: ContentLatestResponse | null;
  loading?: boolean;
};

function listItems(items: ContentLatestResponse['articles'] | undefined, empty: string) {
  const rows = (items ?? []).slice(0, 3);
  if (!rows.length) return <p className="uf-premium-empty">{empty}</p>;
  return (
    <ul className="uf-premium-card__list">
      {rows.map((item) => (
        <li key={item.id}>
          <a href={item.href}>{item.title}</a>
        </li>
      ))}
    </ul>
  );
}

export function ContentPreview({ content, loading }: Props): React.ReactElement {
  return (
    <UfPremiumSection
      title="Articles / Community / Film Room"
      ctaLabel="Browse Content"
      ctaHref="/vault/articles"
      testId="uf-premium-content"
    >
      <div className="uf-premium-grid uf-premium-grid--content">
        <UfPremiumCard title="Latest Articles">
          {loading ? <div className="uf-premium-skeleton" /> : listItems(content?.articles, 'No articles yet.')}
        </UfPremiumCard>
        <UfPremiumCard title="Latest Community Posts">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : (
            listItems(content?.community, 'No community posts yet.')
          )}
        </UfPremiumCard>
        <UfPremiumCard title="Latest Film Room Breakdowns">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : (
            listItems(content?.filmRoom, 'No film room breakdowns yet.')
          )}
        </UfPremiumCard>
      </div>
    </UfPremiumSection>
  );
}

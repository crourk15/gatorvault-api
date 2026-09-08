'use client';

import React from 'react';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import { vaultReviewHref } from '@/lib/vault-film-review-data';

type Props = {
  notes: string[];
  reviewId?: string;
};

export function FilmNotesPanel({ notes, reviewId }: Props): React.ReactElement {
  const reviewHref = vaultReviewHref(reviewId);
  return (
    <div className="gv-gw-film-panel" data-testid="gw-film-notes">
      <ul className="gv-gw-film-panel__list">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {reviewHref ? (
        <p className="gv-gw-film-panel__review">
          <VaultNavLink href={reviewHref}>GatorVault Film Review →</VaultNavLink>
        </p>
      ) : null}
    </div>
  );
}

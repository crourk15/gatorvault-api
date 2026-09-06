'use client';

import React from 'react';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import { vaultReviewHref } from '@/lib/vault-film-review-data';

type Props = {
  notes: string[];
  reviewId?: string;
};

export function FilmNotesPanel({ notes, reviewId }: Props): React.ReactElement {
  return (
    <div className="gv-gw-film-panel" data-testid="gw-film-notes">
      <ul className="gv-gw-film-panel__list">
        {notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {reviewId ? (
        <p className="gv-gw-film-panel__review">
          <VaultNavLink href={vaultReviewHref(reviewId)}>GatorVault Film Review →</VaultNavLink>
        </p>
      ) : null}
    </div>
  );
}

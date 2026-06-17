'use client';

import React from 'react';
import type { IdentityBlock } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';

type Props = {
  blocks: IdentityBlock[];
};

export function TeamIdentitySection({ blocks }: Props): React.ReactElement {
  return (
    <section className="gv-team__cell gv-team__cell--12 gv-team-card gv-team-section" aria-label="Team identity">
      <h2 className="gv-team-card__title">{TEAM_COPY.identity.title}</h2>
      <div className="gv-team-identity-grid">
        {blocks.map((block) => (
          <article key={block.id} className="gv-team-identity-card">
            <h3 className="gv-team-identity-card__title">{block.title}</h3>
            <p className="gv-team-identity-card__desc">&ldquo;{block.description}&rdquo;</p>
          </article>
        ))}
      </div>
    </section>
  );
}

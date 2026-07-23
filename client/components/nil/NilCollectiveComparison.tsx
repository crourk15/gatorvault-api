'use client';

import React from 'react';
import type { NilEliteCollective } from '@/lib/nil-elite-api';

type Props = {
  collectives: NilEliteCollective[];
};

export function NilCollectiveComparison({ collectives }: Props): React.ReactElement {
  return (
    <section className="nil-elite-section" data-testid="nil-collective-comparison">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">SEC Collectives</h2>
          <p className="nil-elite-section__sub">
            School ↔ collective directory. Names only — no fabricated strength meters.
          </p>
        </div>
      </header>

      <div className="nil-collective-dir">
        {collectives.map((row) => (
          <article
            key={row.id}
            className={`nil-collective-dir__row${row.isUf ? ' is-uf' : ''}`}
          >
            <strong className="nil-collective-dir__school">{row.school}</strong>
            <span className="nil-collective-dir__name">{row.collective || '—'}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

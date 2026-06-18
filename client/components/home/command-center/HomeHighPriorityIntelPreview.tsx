'use client';

import React from 'react';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import { playerProfileRoute } from '@/lib/site-routes';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  items: HighPriorityIntelItem[];
  loading?: boolean;
};

export function HomeHighPriorityIntelPreview({ items, loading }: Props): React.ReactElement {
  const display = items.slice(0, 3);

  if (loading) {
    return (
      <section className="gv-hcc-section" aria-label="High priority intel">
        <div className="gv-hcc-intel-stack">
          {[1, 2, 3].map((n) => (
            <div key={n} className="gv-hcc-intel-card gv-hcc-skeleton" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="gv-hcc-section" aria-label="High priority intel" data-testid="home-hp-intel">
      <header className="gv-hcc-section__head">
        <h2 className="gv-hcc-section__title">High Priority Intel</h2>
      </header>
      <div className="gv-hcc-intel-stack">
        {display.map((item) => {
          const pct = Math.max(0, Math.min(100, Math.round(item.ufProb)));
          const delta = item.delta7d ?? 0;
          return (
            <article key={item.id} className="gv-hcc-intel-card">
              <a href={playerProfileRoute(item.slug, 'recruiting')} className="gv-hcc-intel-card__name">
                {item.name}
              </a>
              <p className="gv-hcc-intel-card__meta">
                UF {pct}% · {delta >= 0 ? '+' : ''}
                {delta}% 7d · {item.intelLabel}
              </p>
              <p className="gv-hcc-intel-card__summary">{item.intelSummary}</p>
              <a
                href={playerProfileRoute(item.slug, 'recruiting')}
                className="gv-hcc-intel-card__link"
              >
                More Intel →
              </a>
            </article>
          );
        })}
        {display.length === 0 && (
          <p className="gv-hcc-widget__meta">High priority intel updating — check Recruiting Hub.</p>
        )}
      </div>
      <a href={SITE_ROUTES.recruiting} className="gv-hcc-section__cta">
        View all intel →
      </a>
    </section>
  );
}

'use client';

import React from 'react';
import { useHighPriorityIntelPreview } from '@/hooks/home/useHighPriorityIntelPreview';
import { InViewObserver } from '@/components/home/InViewObserver';
import { SITE_ROUTES } from '@/lib/site-routes';

export function HomeHighPriorityIntelPreview(): React.ReactElement | null {
  const players = useHighPriorityIntelPreview();

  if (!players) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  if (!players.length) return null;

  return (
    <InViewObserver className="gv-card gv-card--fade-in gv-card--intel" visibleClass="gv-card--visible">
      <div data-testid="home-high-priority-intel">
        <div className="gv-card__header">
          <div className="gv-card__title">High Priority Intel</div>
          <div className="gv-card__meta">Top UF targets</div>
        </div>
        <div className="gv-card__body">
          {players.slice(0, 3).map((p) => (
            <a
              key={p.slug}
              href={`${SITE_ROUTES.recruiting}/player/${p.slug}`}
              className="gv-intel-row"
            >
              <div className="gv-intel-row__main">
                <div className="gv-intel-row__name">{p.name}</div>
                <div className="gv-intel-row__pos">
                  {p.position} · {p.school}
                </div>
              </div>
              <div className="gv-intel-row__metrics">
                <div className="gv-intel-row__prob">{p.ufProbability}%</div>
                <div className="gv-intel-row__fit">Fit {p.fitScore}/100</div>
              </div>
            </a>
          ))}
        </div>
        <div className="gv-card__footer">
          <a href={SITE_ROUTES.recruiting} className="gv-link">
            View full Recruiting Hub →
          </a>
        </div>
      </div>
    </InViewObserver>
  );
}

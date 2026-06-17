'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';
import './HomePortalTracker.css';

const MOCK_PORTAL = [
  { name: 'Marcus Webb', pos: 'EDGE', dir: 'in' as const, from: 'Auburn' },
  { name: 'Tyler Brooks', pos: 'WR', dir: 'target' as const, from: 'Georgia' },
  { name: 'Jordan Hale', pos: 'CB', dir: 'out' as const, from: 'UF' },
];

type Props = {
  snapshot: RecruitingSnapshot | null;
};

export function HomePortalTracker({ snapshot }: Props): React.ReactElement {
  const active = snapshot?.portalActive ?? 12;

  return (
    <article
      className="gv-home__cell gv-home__cell--6 gv-home-panel gv-home-card gv-home-portal__card"
      aria-label="Portal tracker"
      data-testid="home-portal"
    >
      <div className="gv-home-portal__head">
        <div>
          <p className="gv-home-card__eyebrow">Portal Tracker</p>
          <h3 className="gv-home-card__title">{active} active targets</h3>
        </div>
        <span className="gv-home-portal__chip">{active} Active</span>
      </div>
      <ul className="gv-home-portal__compact">
        {MOCK_PORTAL.map((p) => (
          <li key={p.name} className="gv-home-portal__compact-row">
            <div className="gv-home-portal__compact-name">
              <strong>{p.name}</strong>
              <span>{p.pos}</span>
            </div>
            <span
              className={
                p.dir === 'in'
                  ? 'gv-portal-tag gv-portal-tag--in'
                  : p.dir === 'out'
                    ? 'gv-portal-tag gv-portal-tag--out'
                    : 'gv-portal-tag gv-portal-tag--target'
              }
            >
              {p.dir === 'in' ? 'In' : p.dir === 'out' ? 'Out' : 'Target'}
            </span>
          </li>
        ))}
      </ul>
      <a href={SITE_ROUTES.futurecast} className="gv-home-card__link">
        Portal watchlist →
      </a>
    </article>
  );
}

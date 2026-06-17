'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { SITE_ROUTES } from '@/lib/site-routes';

const MOCK_PORTAL = [
  { name: 'Marcus Webb', pos: 'EDGE', dir: 'in' as const, from: 'Auburn' },
  { name: 'Tyler Brooks', pos: 'WR', dir: 'target' as const, from: 'Georgia' },
  { name: 'Jordan Hale', pos: 'CB', dir: 'out' as const, from: 'UF' },
];

type Props = {
  snapshot: RecruitingSnapshot | null;
};

export function DashboardPortalActivity({ snapshot }: Props): React.ReactElement {
  const active = snapshot?.portalActive ?? 12;

  return (
    <section className="gv-dash-portal" aria-label="Portal activity" data-testid="dashboard-portal">
      <article className="gv-dash-panel gv-dash-card gv-dash-portal__card">
          <div className="gv-dash-portal__head">
            <div>
              <p className="gv-dash-card__eyebrow">Portal Activity</p>
              <h3 className="gv-dash-card__title">{active} active targets</h3>
            </div>
            <span className="gv-dash-portal__chip">{active} Active</span>
          </div>
          <ul className="gv-dash-portal__compact">
            {MOCK_PORTAL.map((p) => (
              <li key={p.name} className="gv-dash-portal__compact-row">
                <div className="gv-dash-portal__compact-name">
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
        <a href={SITE_ROUTES.futurecast} className="gv-dash-card__link">
          Portal watchlist →
        </a>
      </article>
    </section>
  );
}

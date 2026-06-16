'use client';

import React from 'react';
import type { ContentLatestResponse } from '@/lib/vault-dashboard-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { buildMovementFeedItems } from './dashboard-utils';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  movement: StaffDashboardResponse | null;
  content: ContentLatestResponse | null;
  loading?: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  commit: 'Commit Flip',
  portal: 'Portal',
  movement: 'UF Movement',
  content: 'Latest',
};

export function DashboardMovementFeed({ movement, content, loading }: Props): React.ReactElement {
  const items = buildMovementFeedItems(movement, content);

  if (loading && !movement && !content) {
    return (
      <section className="gv-dash-feed gv-dash__section" aria-label="Movement feed">
        <div className="gv-dash__frame">
          <h2 className="gv-dash-today__heading">{GV_COPY.headlines.movementIntel}</h2>
          <div className="gv-dash-feed__list">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="gv-dash-feed__row gv-dash-skeleton" style={{ minHeight: 64 }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="gv-dash-feed gv-dash__section"
      aria-label="Movement feed"
      data-testid="dashboard-movement-feed"
    >
      <div className="gv-dash__frame">
        <div className="gv-dash-feed__header">
          <h2 className="gv-dash-today__heading">{GV_COPY.headlines.movementIntel}</h2>
          <a href={`${SITE_ROUTES.futurecast}/movement`} className="gv-dash-card__link">
            Full intel →
          </a>
        </div>
        <ul className="gv-dash-feed__list">
          {items.map((item) => (
            <li key={item.id} className="gv-dash-feed__row">
              <span className="gv-dash-feed__icon" aria-hidden="true">
                {item.icon ?? '📌'}
              </span>
              <div className="gv-dash-feed__body">
                <span className={`gv-dash-feed__tag gv-dash-feed__tag--${item.type}`}>
                  {TYPE_LABEL[item.type] ?? item.type}
                </span>
                {item.href ? (
                  <a href={item.href} className="gv-dash-feed__title">
                    {item.title}
                  </a>
                ) : (
                  <p className="gv-dash-feed__title">{item.title}</p>
                )}
                {item.meta ? <p className="gv-dash-feed__meta">{item.meta}</p> : null}
              </div>
            </li>
          ))}
          {items.length === 0 && (
            <li className="gv-dash-feed__empty">Movement intel updating — check back shortly.</li>
          )}
        </ul>
      </div>
    </section>
  );
}

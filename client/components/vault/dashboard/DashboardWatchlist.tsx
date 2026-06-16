'use client';

import React from 'react';
import type { PersonalizedResponse } from '@/lib/vault-dashboard-api';
import { buildWatchlistItems, type WatchlistItem } from './dashboard-utils';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  data: PersonalizedResponse | null;
  loading?: boolean;
};

function WatchlistCard({ item }: { item: WatchlistItem }): React.ReactElement {
  const inner = (
    <>
      <span className="gv-dash-watchlist__badge">{item.badge ?? 'Target'}</span>
      <p className="gv-dash-watchlist__name">{item.name}</p>
      {item.subtitle ? <p className="gv-dash-watchlist__sub">{item.subtitle}</p> : null}
      {item.trend ? (
        <span className={`gv-dash-watchlist__trend gv-dash-watchlist__trend--${item.trend}`}>
          {item.trend === 'up' ? '↑ Rising' : item.trend === 'down' ? '↓ Cooling' : '→ Steady'}
        </span>
      ) : null}
    </>
  );

  if (item.href) {
    return (
      <a href={item.href} className="gv-dash-watchlist__card">
        {inner}
      </a>
    );
  }

  return <div className="gv-dash-watchlist__card">{inner}</div>;
}

export function DashboardWatchlist({ data, loading }: Props): React.ReactElement {
  const items = buildWatchlistItems(data);

  if (loading && !data) {
    return (
      <section className="gv-dash-watchlist gv-dash__section" aria-label="Your watchlist">
        <div className="gv-dash__frame">
          <h2 className="gv-dash-today__heading">Your Watchlist</h2>
          <div className="gv-dash-watchlist__track">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="gv-dash-watchlist__card gv-dash-skeleton" style={{ minWidth: 180 }} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="gv-dash-watchlist gv-dash__section"
      aria-label="Your watchlist"
      data-testid="dashboard-watchlist"
    >
      <div className="gv-dash__frame">
        <div className="gv-dash-watchlist__header">
          <h2 className="gv-dash-today__heading">Your Watchlist</h2>
          <a href={SITE_ROUTES.recruiting} className="gv-dash-card__link">
            View all →
          </a>
        </div>
        <div className="gv-dash-watchlist__track" role="list">
          {items.map((item) => (
            <WatchlistCard key={item.id} item={item} />
          ))}
          {items.length === 0 && (
            <div className="gv-dash-watchlist__empty">
              Follow recruits in Recruiting Hub to build your watchlist.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

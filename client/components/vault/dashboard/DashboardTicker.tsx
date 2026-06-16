'use client';

import React, { useLayoutEffect, useRef } from 'react';
import type { TickerItem } from '@/lib/vault-dashboard-api';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';
import { TICKER_CATEGORY_LABEL } from './dashboard-utils';

export function DashboardTicker({
  items,
  loading,
}: {
  items: TickerItem[];
  loading?: boolean;
}): React.ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);

  const loop = items.length ? [...items, ...items] : [];
  const fallback = [
    {
      id: 'fallback',
      text: 'GatorNation Live — commits, portal buzz, and beat writers updating in real time',
      category: 'breaking',
      url: '/gator-nation-live',
      source: 'GatorVault',
    },
  ];
  const display = loop.length ? loop : [...fallback, ...fallback];

  useLayoutEffect(() => {
    if (loading) return;
    applyTickerScrollDuration(trackRef.current);
  }, [items, loading]);

  if (loading) {
    return (
      <section className="gv-dash-ticker" aria-label="Live ticker">
        <span className="gv-dash-ticker__badge">LIVE</span>
        <div className="gv-dash-ticker__viewport">
          <div className="gv-dash-skeleton" style={{ height: 40, margin: 0, borderRadius: 0 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="gv-dash-ticker" aria-label="Live ticker" data-testid="dashboard-ticker">
      <span className="gv-dash-ticker__badge">LIVE</span>
      <div className="gv-dash-ticker__viewport">
        <div ref={trackRef} className="gv-dash-ticker__track">
          {display.map((item, idx) => (
            <React.Fragment key={`${item.id}_${idx}`}>
              <a href={item.url} className="gv-dash-ticker__item">
                <strong>{TICKER_CATEGORY_LABEL[item.category] || 'UPDATE'}:</strong>{' '}
                {item.text}
              </a>
              {idx < display.length - 1 && (
                <span className="gv-dash-ticker__sep" aria-hidden="true">
                  |
                </span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

'use client';

import React, { useLayoutEffect, useRef } from 'react';
import type { HomeMovementIntelData, TickerItem } from '@/lib/vault-home-api';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';
import { TICKER_STRIP_LABEL } from '@/components/home/home-utils';
import { HomeMovementIntel } from '@/components/home/HomeMovementIntel/HomeMovementIntel';
import './HomeLiveSurface.css';

type Props = {
  tickerItems: TickerItem[];
  movementIntel: HomeMovementIntelData | null;
  loading?: boolean;
};

export function HomeLiveSurface({ tickerItems, movementIntel, loading }: Props): React.ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);
  const loop = tickerItems.length ? [...tickerItems, ...tickerItems] : [];
  const fallback = [
    {
      id: 'fallback',
      text: 'GatorNation Live — commits, portal buzz, and beat writers updating in real time',
      category: 'breaking',
      url: '/vault/live',
      source: 'GatorVault',
    },
  ];
  const display = loop.length ? loop : [...fallback, ...fallback];

  useLayoutEffect(() => {
    if (loading) return;
    applyTickerScrollDuration(trackRef.current);
  }, [tickerItems, loading]);

  return (
    <div className="gv-home__cell gv-home__cell--12 gv-home-live-surface" data-testid="home-live-surface">
      <section className="gv-home-ticker" aria-label="Live ticker">
        <span className="gv-home-ticker__badge">LIVE</span>
        <div className="gv-home-ticker__viewport">
          {loading ? (
            <div className="gv-home-skeleton" style={{ height: 40, margin: 0, borderRadius: 0 }} />
          ) : (
            <div ref={trackRef} className="gv-home-ticker__track">
              {display.map((item, idx) => (
                <React.Fragment key={`${item.id}_${idx}`}>
                  <a href={item.url} className="gv-home-ticker__item">
                    <strong>{TICKER_STRIP_LABEL[item.category] || 'Update'}:</strong> {item.text}
                  </a>
                  {idx < display.length - 1 && (
                    <span className="gv-home-ticker__sep" aria-hidden="true">
                      |
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </section>

      <HomeMovementIntel data={movementIntel} loading={loading && !movementIntel} />
    </div>
  );
}

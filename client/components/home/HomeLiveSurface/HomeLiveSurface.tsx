'use client';

import React, { useLayoutEffect, useRef } from 'react';
import type { ContentLatestResponse, TickerItem } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { SITE_ROUTES } from '@/lib/site-routes';
import { TICKER_STRIP_LABEL, buildMovementFeedItems } from '@/components/home/home-utils';
import './HomeLiveSurface.css';

type Props = {
  tickerItems: TickerItem[];
  movement: StaffDashboardResponse | null;
  content: ContentLatestResponse | null;
  loading?: boolean;
};

export function HomeLiveSurface({ tickerItems, movement, content, loading }: Props): React.ReactElement {
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
  const feedItems = buildMovementFeedItems(movement, content);

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

      <article className="gv-home-card gv-home-feed" aria-label="Live movement feed">
        <div className="gv-home-feed__header">
          <div>
            <div className="gv-home-card__accent" />
            <p className="gv-home-card__eyebrow">Movement Intel</p>
            <h2 className="gv-home-card__title">{GV_COPY.headlines.movementIntel}</h2>
          </div>
          <a href={`${SITE_ROUTES.futurecast}/movement`} className="gv-home-link">
            Full intel →
          </a>
        </div>
        {loading ? (
          <div className="gv-home-skeleton" style={{ minHeight: 160 }} />
        ) : (
          <ul className="gv-home-feed__list">
            {feedItems.map((item) => (
              <li key={item.id} className="gv-home-feed__row">
                <span className="gv-home-feed__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <div className="gv-home-feed__body">
                  <span className={`gv-home-feed__tag gv-home-feed__tag--${item.type}`}>
                    {item.type}
                  </span>
                  {item.href ? (
                    <a href={item.href} className="gv-home-feed__title">
                      {item.title}
                    </a>
                  ) : (
                    <p className="gv-home-feed__title">{item.title}</p>
                  )}
                  {item.meta ? <p className="gv-home-feed__meta">{item.meta}</p> : null}
                </div>
              </li>
            ))}
            {feedItems.length === 0 && (
              <li className="gv-home-feed__empty">Movement intel updating — check back shortly.</li>
            )}
          </ul>
        )}
      </article>
    </div>
  );
}

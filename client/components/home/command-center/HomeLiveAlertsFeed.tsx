'use client';

import React, { useLayoutEffect, useRef } from 'react';
import type { PersonalizedResponse, TickerResponse } from '@/lib/vault-home-api';
import { buildMovementFeedItems } from '@/components/home/home-utils';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { applyTickerScrollDuration } from '@/lib/ticker-duration';

type Props = {
  ticker: TickerResponse | null;
  movement: StaffDashboardResponse | null;
  personalized: PersonalizedResponse | null;
  loading?: boolean;
};

const ALERT_ICONS: Record<string, string> = {
  commit: '🐊',
  portal: '🚪',
  movement: '📈',
  content: '📰',
  analyst: '🎯',
  nil: '💰',
  futurecast: '⚠️',
};

export function HomeLiveAlertsFeed({
  ticker,
  movement,
  personalized,
  loading,
}: Props): React.ReactElement {
  const trackRef = useRef<HTMLDivElement>(null);

  const feedItems = [
    ...(ticker?.items?.slice(0, 6).map((item) => ({
      id: item.id,
      icon: ALERT_ICONS[item.category] ?? '⚠️',
      text: item.text,
      href: item.url,
    })) ?? []),
    ...buildMovementFeedItems(movement).slice(0, 4).map((item) => ({
      id: item.id,
      icon: item.icon ?? '📈',
      text: item.title,
      href: item.href ?? '#',
    })),
    ...(personalized?.alerts?.slice(0, 3).map((a) => ({
      id: a.id,
      icon: '🎯',
      text: a.title,
      href: a.url ?? '#',
    })) ?? []),
  ].slice(0, 12);

  const loop = feedItems.length ? [...feedItems, ...feedItems] : [];

  useLayoutEffect(() => {
    if (loading || !loop.length) return;
    applyTickerScrollDuration(trackRef.current);
  }, [feedItems, loading, loop.length]);

  if (loading) {
    return <section className="gv-hcc-section gv-hcc-ticker gv-hcc-skeleton" style={{ minHeight: 48 }} aria-hidden />;
  }

  return (
    <section className="gv-hcc-section gv-hcc-ticker" aria-label="Live alerts feed" data-testid="home-alerts-feed">
      <span className="gv-hcc-ticker__badge">LIVE</span>
      <div className="gv-hcc-ticker__viewport">
        <div ref={trackRef} className="gv-hcc-ticker__track">
          {(loop.length ? loop : [{ id: 'idle', icon: '📡', text: 'Live alerts updating…', href: '/vault/live' }]).map(
            (item, idx, arr) => (
              <React.Fragment key={`${item.id}_${idx}`}>
                <a href={item.href} className="gv-hcc-ticker__item">
                  <span aria-hidden>{item.icon}</span> {item.text}
                </a>
                {idx < arr.length - 1 && (
                  <span className="gv-hcc-ticker__sep" aria-hidden>
                    |
                  </span>
                )}
              </React.Fragment>
            )
          )}
        </div>
      </div>
    </section>
  );
}

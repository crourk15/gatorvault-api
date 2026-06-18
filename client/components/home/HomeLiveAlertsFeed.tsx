'use client';

import React, { useEffect, useRef } from 'react';
import { useLiveAlertsFeed } from '@/hooks/home/useLiveAlertsFeed';
import { InViewObserver } from '@/components/home/InViewObserver';

const ALERT_ICONS: Record<string, string> = {
  futurecast: '📈',
  analyst: '📰',
  portal: '🔄',
  nil: '💰',
  intel: '🎯',
};

export function HomeLiveAlertsFeed(): React.ReactElement | null {
  const alerts = useLiveAlertsFeed();
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const rows = root.querySelectorAll('.gv-alert-row');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('gv-alert-row--visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    rows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [alerts]);

  if (!alerts) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  if (!alerts.length) return null;

  return (
    <InViewObserver className="gv-card gv-card--fade-in gv-card--alerts" visibleClass="gv-card--visible">
      <div data-testid="home-live-alerts">
      <div className="gv-card__header">
        <div className="gv-card__title">Today&apos;s Recruiting Feed</div>
        <div className="gv-card__meta">Live alerts</div>
      </div>
      <div ref={feedRef} className="gv-card__body gv-alerts-feed">
        {alerts.map((a) => (
          <div key={a.id} className="gv-alert-row">
            {a.isNew ? (
              <span className="gv-badge gv-badge--new gv-alert-row__badge">New</span>
            ) : (
              <span className={`gv-alert-row__icon gv-alert-row__icon--${a.type}`} aria-hidden>
                {ALERT_ICONS[a.type] ?? '•'}
              </span>
            )}
            <span className="gv-alert-row__text">{a.text}</span>
            <span className="gv-alert-row__time">{a.timeAgo}</span>
          </div>
        ))}
      </div>
      </div>
    </InViewObserver>
  );
}

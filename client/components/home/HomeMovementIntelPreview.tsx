'use client';

import React, { useState } from 'react';
import { useMovementIntelPreview } from '@/hooks/home/useMovementIntelPreview';
import { HomeMiniSparkline } from '@/components/home/command-center/widgets/HomeMiniSparkline';
import { InViewObserver } from '@/components/home/InViewObserver';
import { SITE_ROUTES } from '@/lib/site-routes';

type Tab = 'risers' | 'fallers' | 'volatile';

function sparklineFromDelta(delta: number, tab: Tab): number[] {
  const base = 50;
  const step = tab === 'fallers' ? -3 : 3;
  const sign = tab === 'fallers' ? -1 : 1;
  const magnitude = Math.min(Math.abs(delta), 15);
  return Array.from({ length: 7 }, (_, i) => base + sign * magnitude * (i / 6) + step * (i % 2));
}

export function HomeMovementIntelPreview(): React.ReactElement | null {
  const movement = useMovementIntelPreview();
  const [tab, setTab] = useState<Tab>('risers');

  if (!movement) {
    return <div className="gv-home-skeleton-block" aria-hidden />;
  }

  const rows = movement[tab].slice(0, 3);
  if (!rows.length && !movement.risers.length && !movement.fallers.length && !movement.volatile.length) {
    return null;
  }

  const rowClass =
    tab === 'risers'
      ? 'gv-movement-row--riser'
      : tab === 'fallers'
        ? 'gv-movement-row--faller'
        : 'gv-movement-row--volatile';

  const sparkTone = tab === 'risers' ? 'up' : tab === 'fallers' ? 'down' : 'hot';

  return (
    <InViewObserver className="gv-card gv-card--fade-in gv-card--movement" visibleClass="gv-card--visible">
      <div data-testid="home-movement-intel">
        <div className="gv-card__header">
          <div className="gv-card__header-row">
            <div>
              <div className="gv-card__title">Movement Intel</div>
              <div className="gv-card__meta">7-day window</div>
            </div>
            <span className="gv-badge gv-badge--trending">Trending Now</span>
          </div>
        </div>
        <div className="gv-tabs gv-tabs--movement" role="tablist">
          {(['risers', 'fallers', 'volatile'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`gv-tab${tab === key ? ' gv-tab--active' : ''}`}
              onClick={() => setTab(key)}
            >
              {key === 'risers' ? 'Risers' : key === 'fallers' ? 'Fallers' : 'Volatile'}
            </button>
          ))}
        </div>
        <div className="gv-card__body gv-movement-grid">
          {rows.map((p) => (
            <a
              key={p.slug}
              href={`${SITE_ROUTES.recruiting}/player/${p.slug}`}
              className={`gv-movement-row ${rowClass}`}
            >
              <div className="gv-movement-row__name">{p.name}</div>
              <div className="gv-movement-row__delta">
                {tab === 'fallers' ? '' : '+'}
                {p.delta}%
              </div>
              <div className="gv-movement-row__sparkline">
                <HomeMiniSparkline values={sparklineFromDelta(p.delta, tab)} tone={sparkTone} />
              </div>
            </a>
          ))}
        </div>
        <div className="gv-card__footer">
          <a href={`${SITE_ROUTES.recruiting}#movement`} className="gv-link">
            View full Movement Intel →
          </a>
        </div>
      </div>
    </InViewObserver>
  );
}

'use client';

import React, { useState } from 'react';
import { useMovementIntelPreview } from '@/hooks/home/useMovementIntelPreview';
import { SITE_ROUTES } from '@/lib/site-routes';

type Tab = 'risers' | 'fallers' | 'volatile';

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

  return (
    <div className="gv-card gv-card--movement" data-testid="home-movement-intel">
      <div className="gv-card__header">
        <div className="gv-card__title">Movement Intel</div>
        <div className="gv-card__meta">7-day window</div>
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
      <div className="gv-card__body">
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
            <div className="gv-movement-row__sparkline" />
          </a>
        ))}
      </div>
      <div className="gv-card__footer">
        <a href={`${SITE_ROUTES.recruiting}#movement`} className="gv-link">
          View full Movement Intel →
        </a>
      </div>
    </div>
  );
}

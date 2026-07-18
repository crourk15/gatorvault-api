'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { buildWhyItMatters, heatmapSparkPct } from '@/lib/vault-home-api';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { playerProfilePath } from '@/lib/player-routes';
import './MovementIntelPreview.css';

function staffDelta(p: { delta?: number; delta7d?: number }): number {
  return p.delta7d ?? p.delta ?? 0;
}

function MovementBadge({ delta, tone }: { delta: number; tone: 'rise' | 'fall' | 'volatile' }): React.ReactElement {
  if (tone === 'volatile') {
    return (
      <span className="rh-movement-badge rh-movement-badge--volatile">
        <span className="rh-movement-badge__icon" aria-hidden>
          ⚡
        </span>
        ±{Math.abs(delta)}%
      </span>
    );
  }
  if (tone === 'rise') {
    return (
      <span className="rh-movement-badge rh-movement-badge--rise">
        <span className="rh-movement-badge__icon" aria-hidden>
          ↑
        </span>
        +{Math.abs(delta)}%
      </span>
    );
  }
  return (
    <span className="rh-movement-badge rh-movement-badge--fall">
      <span className="rh-movement-badge__icon" aria-hidden>
        ↓
      </span>
      {delta}%
    </span>
  );
}

export function MovementIntelPreview({
  data,
  loading,
}: {
  data: StaffDashboardResponse | null;
  loading?: boolean;
}): React.ReactElement {
  if (loading || !data) {
    return (
      <section className="gv-home-movement gv-home__section" aria-label="Movement intel preview">
        <div className="gv-home__frame">
          <h2 className="gv-home__section-heading gv-type-h2">{GV_COPY.headlines.movementIntel}</h2>
          <div className="gv-home-movement__grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="gv-home-skeleton gv-home-skeleton--card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const risers = data.topRisers.slice(0, 3);
  const fallers = data.topFallers.slice(0, 3);
  const volatile = data.highVolatility.slice(0, 3);
  const sparkPct = heatmapSparkPct(data.heatmap.buckets);
  const bars = 10;
  const hotBars = Math.round((sparkPct / 100) * bars);
  const windowDays = data.movementWindowDays || 7;

  return (
    <section
      className="gv-home-movement gv-home__section"
      aria-label="Movement intel preview"
      data-testid="movement-intel-preview"
    >
      <div className="gv-home__frame">
        <header className="rh-section-head gv-home-movement__head">
          <h2 className="gv-home__section-heading gv-type-h2 rh-section-title">{GV_COPY.headlines.movementIntel}</h2>
          <p className="rh-section-sub">Stock-style UF% movement across risers, fallers, and volatility.</p>
        </header>

        <div className="gv-home-movement__grid">
          <div className="gv-home-movement__card">
            <h3 className="gv-home-movement__card-title gv-home-movement__card-title--up rh-movement-section__title rh-movement-section__title--rise">
              Top Risers
            </h3>
            <ul className="gv-home-movement__list">
              {risers.map((p) => (
                <li key={p.id}>
                  <a
                    href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
                    className="rh-movement-stock-row"
                  >
                    <span className="rh-movement-stock-row__name">{p.name}</span>
                    <MovementBadge delta={staffDelta(p)} tone="rise" />
                  </a>
                </li>
              ))}
              {risers.length === 0 && <li className="gv-home-movement__player">No risers in window.</li>}
            </ul>
          </div>

          <div className="gv-home-movement__card">
            <h3 className="gv-home-movement__card-title gv-home-movement__card-title--down rh-movement-section__title rh-movement-section__title--fall">
              Top Fallers
            </h3>
            <ul className="gv-home-movement__list">
              {fallers.map((p) => (
                <li key={p.id}>
                  <a
                    href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
                    className="rh-movement-stock-row"
                  >
                    <span className="rh-movement-stock-row__name">{p.name}</span>
                    <MovementBadge delta={staffDelta(p)} tone="fall" />
                  </a>
                </li>
              ))}
              {fallers.length === 0 && <li className="gv-home-movement__player">No fallers in window.</li>}
            </ul>
          </div>

          <div className="gv-home-movement__card gv-home-movement__card--volatile">
            <h3 className="gv-home-movement__card-title rh-movement-section__title rh-movement-section__title--volatile">
              Volatile
            </h3>
            <ul className="gv-home-movement__list">
              {volatile.map((p) => (
                <li key={p.id}>
                  <a
                    href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
                    className="rh-movement-stock-row rh-movement-stock-row--volatile"
                  >
                    <span className="rh-movement-stock-row__name">{p.name}</span>
                    <MovementBadge delta={staffDelta(p)} tone="volatile" />
                  </a>
                </li>
              ))}
              {volatile.length === 0 && <li className="gv-home-movement__player">No volatile targets in window.</li>}
            </ul>
          </div>

          <div className="gv-home-movement__card gv-home-movement__card--heatmap">
            <h3 className="gv-home-movement__card-title rh-movement-section__title">Heatmap</h3>
            <div className="gv-home-sparkline" aria-hidden="true">
              {Array.from({ length: bars }, (_, i) => (
                <div
                  key={i}
                  className={`gv-home-sparkline__bar${i < hotBars ? ' is-hot' : ''}`}
                  style={{ height: `${24 + (i % 5) * 11}%`, animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
            <p className="gv-home-movement__metric" title={GV_COPY.tooltips.heatmap}>
              {windowDays}-day volatility score: <strong>{sparkPct}%</strong>
            </p>
            <a
              href="/vault/futurecast/movement"
              className="gv-btn gv-btn--secondary gv-home-movement__cta"
              title={GV_COPY.tooltips.movementScore}
            >
              {GV_COPY.microcopy.openMovementIntel}
            </a>
          </div>
        </div>

        <div className="gv-home-movement__footer">
          <h3 className="gv-home-movement__footer-title">Why This Matters</h3>
          <p className="gv-home-movement__footer-text">{buildWhyItMatters(data)}</p>
        </div>
      </div>
    </section>
  );
}

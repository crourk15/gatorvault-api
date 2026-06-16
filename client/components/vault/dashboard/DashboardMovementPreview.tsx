'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { buildWhyItMatters, heatmapSparkPct } from '@/lib/vault-dashboard-api';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { playerProfilePath } from '@/lib/player-routes';
import { SITE_ROUTES } from '@/lib/site-routes';

export function DashboardMovementPreview({
  data,
  loading,
}: {
  data: StaffDashboardResponse | null;
  loading?: boolean;
}): React.ReactElement {
  if (loading || !data) {
    return (
      <section className="gv-dash-movement gv-dash__section" aria-label="Movement intel preview">
        <div className="gv-dash__frame">
          <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.movementIntel}</h2>
          <div className="gv-dash-movement__grid">
            {[1, 2, 3].map((n) => (
              <div key={n} className="gv-dash-skeleton gv-dash-skeleton--card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  const risers = data.topRisers.slice(0, 3);
  const fallers = data.topFallers.slice(0, 3);
  const sparkPct = heatmapSparkPct(data.heatmap.buckets);
  const bars = 10;
  const hotBars = Math.round((sparkPct / 100) * bars);
  const windowDays = data.movementWindowDays || 7;

  return (
    <section
      className="gv-dash-movement gv-dash__section"
      aria-label="Movement intel preview"
      data-testid="dashboard-movement"
    >
      <div className="gv-dash__frame">
        <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.movementIntel}</h2>

        <div className="gv-dash-movement__grid">
          <div className="gv-dash-movement__card">
            <h3 className="gv-dash-movement__card-title gv-dash-movement__card-title--up">
              TOP RISERS
            </h3>
            <ul className="gv-dash-movement__list">
              {risers.map((p) => (
                <li key={p.id} className="gv-dash-movement__player">
                  <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}>
                    {p.name}
                  </a>
                  <span className="gv-dash-movement__delta gv-dash-movement__delta--up">
                    ↑ +{p.delta ?? 0}
                  </span>
                </li>
              ))}
              {risers.length === 0 && <li className="gv-dash-movement__player">No risers in window.</li>}
            </ul>
          </div>

          <div className="gv-dash-movement__card">
            <h3 className="gv-dash-movement__card-title gv-dash-movement__card-title--down">
              TOP FALLERS
            </h3>
            <ul className="gv-dash-movement__list">
              {fallers.map((p) => (
                <li key={p.id} className="gv-dash-movement__player">
                  <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}>
                    {p.name}
                  </a>
                  <span className="gv-dash-movement__delta gv-dash-movement__delta--down">
                    ↓ {p.delta ?? 0}
                  </span>
                </li>
              ))}
              {fallers.length === 0 && <li className="gv-dash-movement__player">No fallers in window.</li>}
            </ul>
          </div>

          <div className="gv-dash-movement__card">
            <h3 className="gv-dash-movement__card-title">HEATMAP</h3>
            <div className="gv-dash-sparkline" aria-hidden="true">
              {Array.from({ length: bars }, (_, i) => (
                <div
                  key={i}
                  className={`gv-dash-sparkline__bar${i < hotBars ? ' is-hot' : ''}`}
                  style={{ height: `${24 + (i % 5) * 11}%`, animationDelay: `${i * 40}ms` }}
                />
              ))}
            </div>
            <p className="gv-dash-movement__metric" title={GV_COPY.tooltips.heatmap}>
              {windowDays}-day volatility score: <strong>{sparkPct}%</strong>
            </p>
            <a
              href={`${SITE_ROUTES.futurecast}/movement`}
              className="gv-btn gv-btn--secondary gv-dash-movement__cta"
              title={GV_COPY.tooltips.movementScore}
            >
              {GV_COPY.microcopy.openMovementIntel}
            </a>
          </div>
        </div>

        <div className="gv-dash-movement__footer">
          <h3 className="gv-dash-movement__footer-title">WHY THIS MATTERS</h3>
          <p className="gv-dash-movement__footer-text">{buildWhyItMatters(data)}</p>
        </div>
      </div>
    </section>
  );
}

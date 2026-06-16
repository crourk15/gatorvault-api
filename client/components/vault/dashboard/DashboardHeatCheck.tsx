'use client';

import React from 'react';
import { GV_COPY } from '@/lib/gatorvault-copy';

const HEAT_ITEMS = [
  { label: 'QB Room Buzz', score: 88, trend: 'up' as const },
  { label: 'Portal Watch', score: 72, trend: 'flat' as const },
  { label: 'SEC Recruiting', score: 91, trend: 'up' as const },
];

export function DashboardHeatCheck(): React.ReactElement {
  const top = HEAT_ITEMS.reduce((best, item) => (item.score > best.score ? item : best), HEAT_ITEMS[0]);
  const avg = Math.round(HEAT_ITEMS.reduce((sum, i) => sum + i.score, 0) / HEAT_ITEMS.length);

  return (
    <article className="gv-dash-card gv-dash-today__card" data-testid="dashboard-heat-check">
      <p className="gv-dash-card__eyebrow">{GV_COPY.headlines.heatCheck ?? 'Heat Check'}</p>
      <p className="gv-dash-card__stat">{avg}</p>
      <p className="gv-dash-card__meta">
        {top.label} leading at {top.score}
      </p>
      <div className="gv-dash-card__bars">
        {HEAT_ITEMS.map((item) => (
          <div key={item.label} className="gv-dash-card__bar-row">
            <span className="gv-dash-card__bar-label">{item.label}</span>
            <div className="gv-dash-card__bar">
              <div className="gv-dash-card__bar-fill" style={{ width: `${item.score}%` }} />
            </div>
            <span className={`gv-dash-card__trend gv-dash-card__trend--${item.trend}`}>
              {item.trend === 'up' ? '↑' : '→'}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

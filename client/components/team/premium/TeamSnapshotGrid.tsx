'use client';

import React from 'react';
import type { TeamSnapshotMetric } from './team-premium-types';

type Props = {
  metrics: TeamSnapshotMetric[];
};

export function TeamSnapshotGrid({ metrics }: Props): React.ReactElement {
  return (
    <div className="team-snapshot-grid">
      {metrics.map((m) => (
        <article key={m.id} className="team-snapshot-card">
          <span className="team-snapshot-card__label">{m.label}</span>
          <span className="team-snapshot-card__value">{m.value}</span>
          {m.detail ? <span className="team-snapshot-card__detail">{m.detail}</span> : null}
          {m.trend ? (
            <span className={`team-snapshot-card__trend team-snapshot-card__trend--${m.trend}`} aria-hidden="true">
              {m.trend === 'up' ? '▲' : m.trend === 'down' ? '▼' : '—'}
            </span>
          ) : null}
        </article>
      ))}
    </div>
  );
}

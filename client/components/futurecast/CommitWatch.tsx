'use client';

import React from 'react';
import type { CommitWatchEntry } from '@/lib/futurecast-board-types';
import { FC_METRIC_LABELS, formatUfPercent } from '@/lib/futurecast-elite-metrics';
import { playerProfilePath } from '@/lib/player-routes';
import { InsiderPaywall } from './InsiderPaywall';

type Props = {
  entries: CommitWatchEntry[];
};

export function CommitWatch({ entries }: Props): React.ReactElement {
  const top = entries.slice(0, 3);

  const content = (
    <article className="gv-card">
      <div className="gv-card-header">
        <div className="gv-card-title" style={{ margin: 0 }}>
          Commit Watch
        </div>
        <span className="gv-hero-badge" style={{ margin: 0 }}>
          Commit Watch
        </span>
      </div>
      <p className="gv-card-subtitle">Top 3 closest to popping</p>
      <div className="gv-commit-grid">
        {top.map((e) => (
          <a
            key={e.playerId}
            href={playerProfilePath(e.slug, 'HIGH_SCHOOL', true, e.name, 'futurecast')}
            className={`gv-commit-card${e.recentMovement > 0 ? ' gv-pulse' : ''}`}
          >
            <div className="gv-commit-name">{e.name}</div>
            <div className="gv-commit-meta">
              {FC_METRIC_LABELS.uf} {formatUfPercent(e.ufConfidence)}
            </div>
            <div className="gv-commit-trend">
              <img src="/icons/trending-up.svg" alt="" width={16} height={16} />
              +{e.recentMovement.toFixed(2)}
            </div>
          </a>
        ))}
        {top.length === 0 ? <p className="gv-empty">No pulse targets yet.</p> : null}
      </div>
    </article>
  );

  return (
    <InsiderPaywall
      variant="overlay"
      teaser={
        <article className="gv-card">
          <div className="gv-card-title">Commit Watch</div>
          <div className="gv-commit-grid">
            {top.map((e) => (
              <div key={e.playerId} className="gv-commit-card gv-insider-blur">
                <div className="gv-commit-name">{e.name}</div>
              </div>
            ))}
          </div>
        </article>
      }
    >
      {content}
    </InsiderPaywall>
  );
}

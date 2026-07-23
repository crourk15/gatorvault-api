'use client';

import React from 'react';
import type { DepthChartPosition } from '@/lib/team-hub-types';

type Props = {
  positions: DepthChartPosition[];
};

export function DepthChartGrid({ positions }: Props): React.ReactElement {
  return (
    <div className="gv-team-dc-grid">
      {positions.map((pos) => (
        <article
          key={pos.id}
          className={`gv-team-dc-card gv-team-dc-card--${pos.status.toLowerCase()}`}
        >
          <div className="gv-team-dc-card__head">
            <h3 className="gv-team-dc-card__pos">{pos.label}</h3>
            <span className={`gv-team-dc-status gv-team-dc-status--${pos.status}`}>{pos.status}</span>
          </div>
          <ol className="gv-team-dc-depth">
            {pos.players.map((player, i) => (
              <li key={`${player.name}-${i}`} className="gv-team-dc-depth-row">
                <span className="gv-team-dc-depth-rank" aria-label={`Depth ${i + 1}`}>
                  {i + 1}
                </span>
                <div className="gv-team-dc-depth-main">
                  <span className="gv-team-dc-depth-name">{player.name}</span>
                  <span className="gv-team-dc-depth-meta">
                    {[player.classYear, player.notes].filter(Boolean).join(' · ') || '—'}
                  </span>
                </div>
              </li>
            ))}
          </ol>
          {pos.analysis ? <p className="gv-team-dc-analysis">{pos.analysis}</p> : null}
        </article>
      ))}
    </div>
  );
}

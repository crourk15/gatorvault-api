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
        <article key={pos.id} className="gv-team-dc-card">
          <div className="gv-team-dc-card__head">
            <h3 className="gv-team-dc-card__pos">{pos.label}</h3>
            <span className={`gv-team-dc-status gv-team-dc-status--${pos.status}`}>{pos.status}</span>
          </div>
          {pos.players.map((player, i) => (
            <p key={`${player.name}-${i}`} className="gv-team-dc-player">
              <strong>{player.name}</strong>
              {player.classYear ? ` · ${player.classYear}` : ''}
              {player.notes ? ` (${player.notes})` : ''}
            </p>
          ))}
          {pos.analysis && (
            <p className="gv-team-dc-player" style={{ marginTop: '0.65rem', fontStyle: 'italic' }}>
              {pos.analysis}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

'use client';

import React from 'react';
import type { DepthChartGroup } from '@/lib/game-week-data';
import { PlayerHeadshot } from './PlayerHeadshot';

type Props = {
  groups: DepthChartGroup[];
};

function trendArrow(trend: 'up' | 'down' | 'flat'): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

export function DepthChartGrid({ groups }: Props): React.ReactElement {
  return (
    <div className="gv-gw-depth-grid" data-testid="gw-depth-chart">
      {groups.map((g) => (
        <div key={g.position} className="gv-gw-depth-col">
          <div className="gv-gw-depth-col__pos">{g.position}</div>
          {g.players.map((p) => (
            <div key={p.slug} className="gv-gw-depth-player">
              <PlayerHeadshot slug={p.slug} name={p.name} size="sm" />
              <div className="gv-gw-depth-player__meta">
                <div className="gv-gw-depth-player__name">
                  {p.name}
                  {p.isStarter ? <span className="gv-gw-depth-player__starter" aria-label="Starter"> ★</span> : null}
                </div>
                <div className="gv-gw-depth-player__snap">
                  <span>{p.snapPct}% snaps</span>
                  <span className={`gv-gw-depth-player__trend gv-gw-depth-player__trend--${p.trend}`}>
                    {trendArrow(p.trend)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

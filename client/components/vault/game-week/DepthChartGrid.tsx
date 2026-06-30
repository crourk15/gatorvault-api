'use client';

import React from 'react';
import { headshotUrl, type DepthChartGroup } from '@/lib/game-week-data';

type Props = {
  groups: DepthChartGroup[];
};

export function DepthChartGrid({ groups }: Props): React.ReactElement {
  return (
    <div className="gv-gw-depth-grid" data-testid="gw-depth-chart">
      {groups.map((g) => (
        <div key={g.position} className="gv-gw-depth-col">
          <div className="gv-gw-depth-col__pos">{g.position}</div>
          {g.players.map((p) => (
            <div key={p.slug} className="gv-gw-depth-player">
              <img
                src={headshotUrl(p.slug)}
                alt=""
                className="gv-gw-depth-player__headshot"
                width={28}
                height={28}
              />
              <div>
                <div>
                  {p.name}
                  {p.isStarter ? <span className="gv-gw-depth-player__starter"> ★</span> : null}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#9CA3AF' }}>
                  {p.snapPct}% snaps {p.trend === 'up' ? '↑' : p.trend === 'down' ? '↓' : '→'}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

'use client';

import React from 'react';
import type { DepthChartGroup } from '@/lib/game-week-data';
import { vaultGradeForSlug } from '@/lib/game-week-data';
import { SwingPlayerAvatar } from './SwingPlayerAvatar';

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
          {g.players.map((p, i) => (
            <div key={p.slug} className="gv-gw-depth-player">
              <SwingPlayerAvatar
                slug={p.slug}
                name={p.name}
                position={g.position}
                impact={vaultGradeForSlug(p.slug) ?? Math.max(55, 88 - i * 12)}
                size="sm"
              />
              <div className="gv-gw-depth-player__meta">
                <div className="gv-gw-depth-player__name">
                  {p.name}
                  {p.isStarter ? <span className="gv-gw-depth-player__starter" aria-label="Starter"> ★</span> : null}
                </div>
                <div className="gv-gw-depth-player__snap">
                  <span>{p.isStarter ? 'Starter' : `Depth ${i + 1}`}</span>
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

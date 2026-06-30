'use client';

import React from 'react';
import type { RadarAxis } from '@/lib/game-week-data';

type Props = {
  axes: RadarAxis[];
  opponentName: string;
};

const SIZE = 220;
const CENTER = SIZE / 2;
const MAX_R = 80;

function point(angleIdx: number, value: number, total: number): [number, number] {
  const angle = (Math.PI * 2 * angleIdx) / total - Math.PI / 2;
  const r = (value / 100) * MAX_R;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const [x, y] = point(i, v, values.length);
      return `${x},${y}`;
    })
    .join(' ');
}

export function ScoutingRadarChart({ axes, opponentName }: Props): React.ReactElement {
  const n = axes.length;
  const gridLevels = [25, 50, 75, 100];

  return (
    <div className="gv-gw-radar" data-testid="gw-radar-chart">
      <p className="gv-gw-radar__heading">Scouting radar</p>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Scouting radar comparison">
        {gridLevels.map((lvl) => (
          <polygon
            key={lvl}
            points={polygonPoints(Array(n).fill(lvl))}
            fill="none"
            stroke="rgba(199,199,199,0.2)"
            strokeWidth="1"
          />
        ))}
        {axes.map((_, i) => {
          const [x, y] = point(i, 100, n);
          return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="rgba(199,199,199,0.25)" />;
        })}
        <polygon
          points={polygonPoints(axes.map((a) => a.opp))}
          fill="rgba(100,116,139,0.25)"
          stroke="#64748B"
          strokeWidth="2"
        />
        <polygon
          points={polygonPoints(axes.map((a) => a.uf))}
          fill="rgba(250,70,22,0.2)"
          stroke="#FA4616"
          strokeWidth="2"
        />
        {axes.map((a, i) => {
          const [x, y] = point(i, 115, n);
          return (
            <text key={a.label} x={x} y={y} textAnchor="middle" dominantBaseline="middle" fill="#C7C7C7" fontSize="9">
              {a.label}
            </text>
          );
        })}
      </svg>
      <div className="gv-gw-radar__legend">
        <span className="gv-gw-radar__legend-uf">● UF</span>
        <span className="gv-gw-radar__legend-opp">● {opponentName.split(' ')[0]}</span>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import type { MovementHeatmap as HeatmapData } from '@/lib/futurecast-board-types';

type Props = {
  heatmap: HeatmapData;
  buckets?: { label: string; count: number }[];
  windowDays?: number;
};

function sparkWidth(count: number, max: number): number {
  if (max <= 0) return 20;
  return Math.max(20, Math.round((count / max) * 100));
}

export function MovementHeatmapCard({
  heatmap,
  buckets,
  windowDays = 7,
}: Props): React.ReactElement {
  const blocks = buckets ?? [
    { label: 'Up', count: heatmap.upCount, tone: 'up' as const },
    { label: 'Down', count: heatmap.downCount, tone: 'down' as const },
    { label: 'Flat', count: heatmap.flatCount, tone: 'flat' as const },
  ];

  const max = Math.max(...blocks.map((b) => b.count), 1);

  return (
    <article className="gv-card gv-fade-in">
      <div className="gv-card-title">Movement Heatmap (Last {windowDays} Days)</div>
      <div className="gv-heatmap-grid">
        {blocks.map((block) => {
          const tone =
            block.label === 'Up' ? 'up' : block.label === 'Down' ? 'down' : 'flat';
          return (
            <div
              key={block.label}
              className={`gv-heatmap-block gv-heatmap-block--${tone}`}
              title={`${block.label}: ${block.count} players in the last ${windowDays} days`}
            >
              <div className="gv-heatmap-block-label">{block.label}</div>
              <div className="gv-heatmap-block-count">{block.count}</div>
              <div className="gv-heatmap-block-sparkline" aria-hidden="true">
                <span style={{ width: `${sparkWidth(block.count, max)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

/**
 * 7-day movement summary — Up / Down / Flat intensity buckets.
 */
import React from 'react';

export interface MovementHeatmapBucket {
  label: string;
  count: number;
}

export interface MovementHeatmapProps {
  buckets: MovementHeatmapBucket[] | null | undefined;
  windowDays?: number;
}

function heatmapColor(label: string, intensity: number): string {
  if (label === 'Up') {
    const alpha = 0.2 + 0.6 * intensity;
    return `rgba(63, 185, 80, ${alpha})`;
  }
  if (label === 'Down') {
    const alpha = 0.2 + 0.6 * intensity;
    return `rgba(248, 81, 73, ${alpha})`;
  }
  const alpha = 0.1 + 0.4 * intensity;
  return `rgba(139, 148, 158, ${alpha})`;
}

export function MovementHeatmap({
  buckets,
  windowDays = 7,
}: MovementHeatmapProps): React.ReactElement {
  if (!buckets?.length) {
    return (
      <p className="fc-movement-heatmap__empty" data-testid="movement-heatmap-empty">
        No movement data available.
      </p>
    );
  }

  const max = Math.max(...buckets.map((bucket) => bucket.count || 0), 1);

  return (
    <div className="fc-movement-heatmap" data-testid="movement-heatmap">
      <h2 className="fc-movement-heatmap__title">
        Movement Heatmap (Last {windowDays} Days)
      </h2>
      <div className="fc-movement-heatmap__grid">
        {buckets.map((bucket) => {
          const intensity = bucket.count / max;
          return (
            <div
              key={bucket.label}
              className="fc-movement-heatmap__cell"
              style={{ backgroundColor: heatmapColor(bucket.label, intensity) }}
            >
              <span className="fc-movement-heatmap__label">{bucket.label}</span>
              <span className="fc-movement-heatmap__count">{bucket.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

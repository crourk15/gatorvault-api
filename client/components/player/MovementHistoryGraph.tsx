/**
 * MODEL confidence over time — stock-style line chart.
 */
import React from 'react';

export interface MovementHistoryPoint {
  date: string;
  confidence: number;
}

export interface MovementHistoryGraphProps {
  history: MovementHistoryPoint[] | null | undefined;
}

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 32, left: 40 };
const Y_TICKS = [0, 25, 50, 75, 100];

function formatLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function clampConfidence(value: number): number {
  return Math.min(100, Math.max(0, value));
}

export function MovementHistoryGraph({
  history,
}: MovementHistoryGraphProps): React.ReactElement {
  if (!history?.length) {
    return (
      <p className="fc-movement-history__empty" data-testid="movement-history-empty">
        No movement history available.
      </p>
    );
  }

  const innerW = CHART_WIDTH - PAD.left - PAD.right;
  const innerH = CHART_HEIGHT - PAD.top - PAD.bottom;
  const baselineY = PAD.top + innerH;

  const points = history.map((entry, index) => {
    const confidence = clampConfidence(entry.confidence);
    const x =
      history.length === 1
        ? PAD.left + innerW / 2
        : PAD.left + (index / (history.length - 1)) * innerW;
    const y = PAD.top + innerH - (confidence / 100) * innerH;
    return { x, y, confidence, date: entry.date, label: formatLabel(entry.date) };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`;

  const xLabelIndices =
    history.length <= 4
      ? points.map((_, index) => index)
      : [0, Math.floor((history.length - 1) / 2), history.length - 1];

  return (
    <div className="fc-movement-history" data-testid="movement-history-graph">
      <svg
        className="fc-movement-history__chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label="Confidence movement history chart"
      >
        {Y_TICKS.map((tick) => {
          const y = PAD.top + innerH - (tick / 100) * innerH;
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={CHART_WIDTH - PAD.right}
                y2={y}
                className="fc-movement-history__grid"
              />
              <text x={PAD.left - 8} y={y + 4} className="fc-movement-history__tick">
                {tick}
              </text>
            </g>
          );
        })}

        <path d={areaPath} className="fc-movement-history__area" />
        <path d={linePath} className="fc-movement-history__line" />

        {points.map((point) => (
          <circle
            key={point.date}
            cx={point.x}
            cy={point.y}
            r={3}
            className="fc-movement-history__point"
          >
            <title>{`${point.label}: ${point.confidence}%`}</title>
          </circle>
        ))}

        {xLabelIndices.map((index) => {
          const point = points[index];
          return (
            <text
              key={point.date}
              x={point.x}
              y={CHART_HEIGHT - 8}
              className="fc-movement-history__tick fc-movement-history__tick--x"
            >
              {point.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

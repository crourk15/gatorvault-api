'use client';

import React from 'react';
import type { RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { getHeatColor } from '@/lib/recruiting-hub-scoring';
import { ALL_STATE_CODES, projectLatLng, US_STATE_CENTROIDS } from './us-state-centroids';

type Props = {
  states: RhHubFootprintState[];
  width: number;
  height: number;
  hoveredState: string | null;
  onHover: (state: string | null) => void;
};

export function StateHeatLayer({ states, width, height, hoveredState, onHover }: Props): React.ReactElement {
  const stateMap = new Map(states.map((s) => [s.state, s]));

  return (
    <g className="rh-footprint-heat">
      {ALL_STATE_CODES.map((code) => {
        const data = stateMap.get(code);
        const centroid = US_STATE_CENTROIDS[code];
        if (!centroid) return null;
        const { x, y } = projectLatLng(centroid.lat, centroid.lng, width, height);
        const pipelineScore = data?.pipelineScore ?? 0;
        const fill = data ? getHeatColor(pipelineScore) : '#374151';
        const opacity = data ? 0.35 + (pipelineScore / 100) * 0.55 : 0.12;
        const radius = data ? 14 + (pipelineScore / 100) * 10 : 8;
        const isHovered = hoveredState === code;

        return (
          <circle
            key={code}
            cx={x}
            cy={y}
            r={radius}
            fill={fill}
            fillOpacity={opacity}
            stroke={isHovered ? '#ffffff' : fill}
            strokeWidth={isHovered ? 2 : 0.5}
            strokeOpacity={isHovered ? 1 : 0.4}
            className="rh-footprint-state-circle"
            onMouseEnter={() => onHover(code)}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
}

'use client';

import React from 'react';
import type { RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { getOutlineColor } from '@/lib/recruiting-hub-scoring';
import { ALL_STATE_CODES, projectLatLng, US_STATE_CENTROIDS } from './us-state-centroids';

type Props = {
  states: RhHubFootprintState[];
  width: number;
  height: number;
};

export function BattleDifficultyLayer({ states, width, height }: Props): React.ReactElement {
  const stateMap = new Map(states.map((s) => [s.state, s]));

  return (
    <g className="rh-footprint-battle">
      {ALL_STATE_CODES.map((code) => {
        const data = stateMap.get(code);
        if (!data) return null;
        const centroid = US_STATE_CENTROIDS[code];
        if (!centroid) return null;
        const { x, y } = projectLatLng(centroid.lat, centroid.lng, width, height);
        const color = getOutlineColor(data.ufScore);
        const radius = 14 + (data.pipelineScore / 100) * 10;

        return (
          <circle
            key={`battle-${code}`}
            cx={x}
            cy={y}
            r={radius + 3}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeOpacity={0.85}
            pointerEvents="none"
          />
        );
      })}
    </g>
  );
}

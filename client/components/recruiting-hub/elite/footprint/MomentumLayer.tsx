'use client';

import React from 'react';
import type { RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { momentumSymbol } from '@/lib/recruiting-hub-scoring';
import { ALL_STATE_CODES, projectLatLng, US_STATE_CENTROIDS } from './us-state-centroids';

type Props = {
  states: RhHubFootprintState[];
  width: number;
  height: number;
};

export function MomentumLayer({ states, width, height }: Props): React.ReactElement {
  const stateMap = new Map(states.map((s) => [s.state, s]));

  return (
    <g className="rh-footprint-momentum">
      {ALL_STATE_CODES.map((code) => {
        const data = stateMap.get(code);
        if (!data) return null;
        const centroid = US_STATE_CENTROIDS[code];
        if (!centroid) return null;
        const { x, y } = projectLatLng(centroid.lat, centroid.lng, width, height);

        return (
          <g key={`momentum-${code}`} pointerEvents="none">
            <text
              x={x}
              y={y - 18}
              textAnchor="middle"
              className={`rh-footprint-momentum-label rh-footprint-momentum-label--${data.momentum}`}
            >
              {momentumSymbol(data.momentum)}
            </text>
            <text x={x} y={y + 4} textAnchor="middle" className="rh-footprint-state-label">
              {code}
            </text>
          </g>
        );
      })}
    </g>
  );
}

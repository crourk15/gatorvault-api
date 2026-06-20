'use client';

import React from 'react';
import { Geography } from 'react-simple-maps';
import type { RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { getHeatColor } from '@/lib/recruiting-hub-scoring';
import { stateCodeFromGeo } from './state-geo-utils';

type GeoFeature = {
  rsmKey: string;
  properties?: { name?: string; postal?: string; st?: string };
  svgPath: string;
};

type Props = {
  geographies: GeoFeature[];
  states: RhHubFootprintState[];
  hoveredState: string | null;
  onHover: (state: string | null) => void;
};

export function StateHeatLayer({ geographies, states, hoveredState, onHover }: Props): React.ReactElement {
  const stateMap = new Map(states.map((s) => [s.state, s]));

  return (
    <g className="rh-footprint-heat">
      {geographies.map((geo) => {
        const code = stateCodeFromGeo(geo);
        const data = code ? stateMap.get(code) : null;
        const hasData = Boolean(data && data.pipelineScore > 0);
        const fill = hasData ? getHeatColor(data!.pipelineScore) : '#1f2937';
        const fillOpacity = hasData ? 0.55 + (data!.pipelineScore / 100) * 0.4 : 0.15;
        const isHovered = code != null && hoveredState === code;

        return (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={isHovered ? '#ffffff' : fill}
            strokeWidth={isHovered ? 1.2 : 0.35}
            className="rh-footprint-state-path"
            style={{
              default: { outline: 'none', cursor: hasData ? 'pointer' : 'default' },
              hover: { outline: 'none', fillOpacity: hasData ? 0.95 : 0.2 },
              pressed: { outline: 'none' },
            }}
            onMouseEnter={() => {
              if (code && hasData) onHover(code);
            }}
            onMouseLeave={() => onHover(null)}
          />
        );
      })}
    </g>
  );
}

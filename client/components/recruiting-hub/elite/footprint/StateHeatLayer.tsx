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
  activeState: string | null;
  onActivate: (state: string | null) => void;
};

export function StateHeatLayer({ geographies, states, activeState, onActivate }: Props): React.ReactElement {
  const stateMap = new Map(states.map((s) => [s.state, s]));

  return (
    <g className="rh-footprint-heat">
      {geographies.map((geo) => {
        const code = stateCodeFromGeo(geo);
        const data = code ? stateMap.get(code) : null;
        const hasData = Boolean(data && data.pipelineScore > 0);
        const fill = hasData ? getHeatColor(data!.pipelineScore) : '#0b1224';
        const fillOpacity = hasData ? 0.62 + (data!.pipelineScore / 100) * 0.35 : 0.22;
        const isActive = code != null && activeState === code;

        return (
          <Geography
            key={geo.rsmKey}
            geography={geo}
            fill={fill}
            fillOpacity={isActive ? Math.min(1, fillOpacity + 0.18) : fillOpacity}
            stroke={isActive ? '#fa4616' : hasData ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}
            strokeWidth={isActive ? 1.6 : 0.45}
            className={`rh-footprint-state-path${isActive ? ' is-active' : ''}${hasData ? ' has-data' : ''}`}
            style={{
              default: { outline: 'none', cursor: hasData ? 'pointer' : 'default' },
              hover: { outline: 'none', fillOpacity: hasData ? 0.98 : 0.28 },
              pressed: { outline: 'none' },
            }}
            onMouseEnter={() => {
              if (code && hasData) onActivate(code);
            }}
            {...({
              onClick: () => {
                if (code && hasData) onActivate(code);
              },
            } as Record<string, unknown>)}
          />
        );
      })}
    </g>
  );
}

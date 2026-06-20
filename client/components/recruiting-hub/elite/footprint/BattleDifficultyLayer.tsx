'use client';

import React from 'react';
import { Geography } from 'react-simple-maps';
import type { RhHubFootprintState } from '@/lib/recruiting-hub-elite-api';
import { getOutlineColor } from '@/lib/recruiting-hub-scoring';
import { stateCodeFromGeo } from './state-geo-utils';

type GeoFeature = {
  rsmKey: string;
  properties?: { name?: string; postal?: string; st?: string };
  svgPath: string;
};

type Props = {
  geographies: GeoFeature[];
  states: RhHubFootprintState[];
};

export function BattleDifficultyLayer({ geographies, states }: Props): React.ReactElement {
  const stateMap = new Map(states.map((s) => [s.state, s]));

  return (
    <g className="rh-footprint-battle" pointerEvents="none">
      {geographies.map((geo) => {
        const code = stateCodeFromGeo(geo);
        const data = code ? stateMap.get(code) : null;
        if (!data || data.ufScore == null) return null;

        const stroke = getOutlineColor(data.ufScore);

        return (
          <Geography
            key={`battle-${geo.rsmKey}`}
            geography={geo}
            fill="transparent"
            stroke={stroke}
            strokeWidth={1.5}
            style={{
              default: { outline: 'none' },
              hover: { outline: 'none' },
              pressed: { outline: 'none' },
            }}
          />
        );
      })}
    </g>
  );
}

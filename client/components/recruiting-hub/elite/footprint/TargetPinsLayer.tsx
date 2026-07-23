'use client';

import React from 'react';
import { Marker } from 'react-simple-maps';
import type { RhHubFootprintPin } from '@/lib/recruiting-hub-elite-api';

type Props = {
  pins: RhHubFootprintPin[];
};

function pinVisual(pin: RhHubFootprintPin): { fill: string; r: number; ring: string } {
  if (pin.pinType === 'commit' || pin.status === 'commit') {
    return { fill: '#fa4616', r: 5.5, ring: '#ffffff' };
  }
  if (pin.pinType === 'battle') {
    return { fill: '#fbbf24', r: 5, ring: '#001a33' };
  }
  return { fill: '#7aa2ff', r: 4.5, ring: '#ffffff' };
}

export function TargetPinsLayer({ pins }: Props): React.ReactElement {
  return (
    <g className="rh-footprint-pins">
      {pins.map((pin) => {
        const { fill, r, ring } = pinVisual(pin);
        return (
          <Marker key={pin.id} coordinates={[pin.lng, pin.lat]}>
            <circle r={r + 2.2} fill={fill} fillOpacity={0.22} className="rh-footprint-pin__glow" />
            <circle
              r={r}
              fill={fill}
              stroke={ring}
              strokeWidth={1.25}
              className={`rh-footprint-pin rh-footprint-pin--${pin.pinType || pin.status}`}
            >
              <title>
                {pin.name} ({pin.state}) — {pin.status}
                {pin.ufScore != null ? ` · UF ${pin.ufScore}` : ''}
              </title>
            </circle>
          </Marker>
        );
      })}
    </g>
  );
}

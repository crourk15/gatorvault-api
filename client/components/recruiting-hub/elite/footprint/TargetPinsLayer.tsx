'use client';

import React from 'react';
import type { RhHubFootprintPin } from '@/lib/recruiting-hub-elite-api';
import { getPinColor } from '@/lib/recruiting-hub-scoring';
import { projectLatLng } from './us-state-centroids';

type Props = {
  pins: RhHubFootprintPin[];
  width: number;
  height: number;
};

export function TargetPinsLayer({ pins, width, height }: Props): React.ReactElement {
  return (
    <g className="rh-footprint-pins">
      {pins.map((pin) => {
        const { x, y } = projectLatLng(pin.lat, pin.lng, width, height);
        const color = getPinColor(pin.pinType, pin.ufScore);
        return (
          <g key={pin.id} className="rh-footprint-pin" transform={`translate(${x}, ${y})`}>
            <circle r={5} fill={color} stroke="#ffffff" strokeWidth={1.2} />
            <title>{`${pin.name} · ${pin.state} · UF ${pin.ufScore}`}</title>
          </g>
        );
      })}
    </g>
  );
}

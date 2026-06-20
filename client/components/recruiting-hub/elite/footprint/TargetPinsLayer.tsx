'use client';

import React from 'react';
import { Marker } from 'react-simple-maps';
import type { RhHubFootprintPin } from '@/lib/recruiting-hub-elite-api';
import { getPinColor } from '@/lib/recruiting-hub-scoring';

type Props = {
  pins: RhHubFootprintPin[];
};

export function TargetPinsLayer({ pins }: Props): React.ReactElement {
  return (
    <g className="rh-footprint-pins">
      {pins.map((pin) => {
        const fill = getPinColor(pin.pinType, pin.ufScore ?? 0);
        return (
          <Marker key={pin.id} coordinates={[pin.lng, pin.lat]}>
            <circle r={4.5} fill={fill} stroke="#ffffff" strokeWidth={1} className="rh-footprint-pin">
              <title>
                {pin.name} ({pin.state}) — {pin.status}
              </title>
            </circle>
          </Marker>
        );
      })}
    </g>
  );
}

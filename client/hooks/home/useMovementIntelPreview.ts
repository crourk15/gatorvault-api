'use client';

import { useEffect, useState } from 'react';
import { fetchMovementIntel } from '@/lib/recruiting-ui-api';
import { movementDelta7d } from '@/lib/movement-intel-types';

export type MovementPlayer = {
  slug: string;
  name: string;
  delta: number;
};

export type MovementPreview = {
  risers: MovementPlayer[];
  fallers: MovementPlayer[];
  volatile: MovementPlayer[];
};

export function useMovementIntelPreview(): MovementPreview | null {
  const [movement, setMovement] = useState<MovementPreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchMovementIntel()
      .then((intel) => {
        if (cancelled) return;
        setMovement({
          risers:
            intel.risers?.slice(0, 6).map((p) => ({
              slug: p.slug || p.id,
              name: p.name,
              delta: movementDelta7d(p),
            })) ?? [],
          fallers:
            intel.fallers?.slice(0, 6).map((p) => ({
              slug: p.slug || p.id,
              name: p.name,
              delta: movementDelta7d(p),
            })) ?? [],
          volatile:
            intel.volatile?.slice(0, 6).map((p) => ({
              slug: p.slug || p.id,
              name: p.name,
              delta: movementDelta7d(p),
            })) ?? [],
        });
      })
      .catch(() => {
        if (!cancelled) setMovement({ risers: [], fallers: [], volatile: [] });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return movement;
}

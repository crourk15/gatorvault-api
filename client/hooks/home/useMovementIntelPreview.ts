'use client';

import { useEffect, useState } from 'react';
import { fetchHomeMovementIntel, fetchMovementPreview } from '@/lib/vault-home-api';
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

function mapStaff(
  rows: { id: string; slug?: string; name: string; delta?: number; delta7d?: number }[]
): MovementPlayer[] {
  return rows.map((p) => ({
    slug: p.slug || p.id,
    name: p.name,
    delta: p.delta7d ?? p.delta ?? 0,
  }));
}

export function useMovementIntelPreview(): MovementPreview | null {
  const [movement, setMovement] = useState<MovementPreview | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([fetchHomeMovementIntel(), fetchMovementPreview()])
      .then(([intel, staff]) => {
        if (cancelled) return;
        setMovement({
          risers:
            intel.risers?.slice(0, 6).map((p) => ({
              slug: p.slug || p.id,
              name: p.name,
              delta: movementDelta7d(p),
            })) ?? mapStaff(staff.topRisers),
          fallers:
            intel.fallers?.slice(0, 6).map((p) => ({
              slug: p.slug || p.id,
              name: p.name,
              delta: movementDelta7d(p),
            })) ?? mapStaff(staff.topFallers),
          volatile:
            intel.volatile?.slice(0, 6).map((p) => ({
              slug: p.slug || p.id,
              name: p.name,
              delta: movementDelta7d(p),
            })) ?? mapStaff(staff.highVolatility),
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

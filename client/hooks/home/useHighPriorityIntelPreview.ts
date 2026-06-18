'use client';

import { useEffect, useState } from 'react';
import { fetchHomeIntelPreview } from '@/lib/vault-home-api';

export type HighPriorityPlayer = {
  slug: string;
  name: string;
  position: string;
  school: string;
  ufProbability: number;
  fitScore: number;
};

export function useHighPriorityIntelPreview(): HighPriorityPlayer[] | null {
  const [players, setPlayers] = useState<HighPriorityPlayer[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchHomeIntelPreview()
      .then((items) => {
        if (cancelled) return;
        setPlayers(
          items.slice(0, 6).map((item) => ({
            slug: item.slug,
            name: item.name,
            position: item.position,
            school: item.school ?? '—',
            ufProbability: Math.round(item.ufProb),
            fitScore: Math.min(100, Math.round(item.ufProb * 0.95)),
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setPlayers([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return players;
}

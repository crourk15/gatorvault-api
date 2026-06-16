'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchHighPriorityIntel, type RecruitingIntelItem } from '@/api/recruiting';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';

export type HighPriorityIntelEntry = {
  intel: RecruitingIntelItem;
  playerName: string;
  position?: string | null;
};

function mergeIntel(
  apiIntel: RecruitingIntelItem[],
  players: HighPriorityPlayer[]
): HighPriorityIntelEntry[] {
  const bySlug = new Map(players.map((p) => [p.slug, p]));

  if (apiIntel.length) {
    return apiIntel.map((intel) => {
      const player = bySlug.get(intel.playerId);
      return {
        intel,
        playerName: player?.name ?? intel.playerId,
        position: player?.position ?? null,
      };
    });
  }

  return players.slice(0, 4).map((p, i) => ({
    intel: {
      id: p.slug || `hp-${i}`,
      playerId: p.slug,
      timestamp: p.visitStart ?? new Date().toISOString(),
      text: p.notePreview || p.insiderNotes || p.skinny || 'Insider tracking active.',
      ufProbability:
        p.ufProbability != null
          ? p.ufProbability <= 1
            ? Math.round(p.ufProbability * 100)
            : Math.round(p.ufProbability)
          : 0,
    },
    playerName: p.name,
    position: p.position,
  }));
}

export function useIntelFeed(players: HighPriorityPlayer[]): {
  items: HighPriorityIntelEntry[];
  loading: boolean;
} {
  const [apiIntel, setApiIntel] = useState<RecruitingIntelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchHighPriorityIntel()
      .then((intel) => {
        if (!cancelled) setApiIntel(intel);
      })
      .catch(() => {
        if (!cancelled) setApiIntel([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => mergeIntel(apiIntel, players), [apiIntel, players]);

  return { items, loading: loading && items.length === 0 };
}

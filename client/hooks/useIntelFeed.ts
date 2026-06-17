'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchHighPriorityIntel, type RecruitingIntelItem } from '@/api/recruiting';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { IntelCardProps } from '@/components/recruiting-hub/types/intel';
import { mapPlayerToIntelCard, mapToIntelCard } from '@/components/recruiting-hub/utils/intelMapping';

const INTEL_POLL_MS = 60_000;

function mergeIntel(players: HighPriorityPlayer[], apiIntel: RecruitingIntelItem[]): IntelCardProps[] {
  const bySlug = new Map(players.map((p) => [p.slug, p]));

  if (apiIntel.length) {
    return apiIntel.slice(0, 4).map((intel) => mapToIntelCard(intel, bySlug.get(intel.playerId)));
  }

  return players.slice(0, 4).map((p, i) => mapPlayerToIntelCard(p, i));
}

export function useIntelFeed(players: HighPriorityPlayer[]): {
  items: IntelCardProps[];
  loading: boolean;
  lastUpdated: string | null;
} {
  const [apiIntel, setApiIntel] = useState<RecruitingIntelItem[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(force = false) {
      if (!cancelled && apiIntel.length === 0) setLoading(true);
      try {
        const intel = await fetchHighPriorityIntel({ force });
        if (!cancelled) {
          setApiIntel(intel.items);
          setLastUpdated(intel.lastUpdated);
        }
      } catch {
        if (!cancelled) setApiIntel([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load(false);
    timer = setInterval(() => void load(true), INTEL_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  const items = useMemo(() => mergeIntel(players, apiIntel), [apiIntel, players]);

  return { items, loading: loading && items.length === 0, lastUpdated };
}

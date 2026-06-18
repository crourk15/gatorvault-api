'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchHighPriorityIntel, type RecruitingIntelItem } from '@/api/recruiting';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import type { HighPriorityIntelItem } from '@/components/recruiting-hub/HighPriorityIntel/types';
import {
  mapBoardTargetToHighPriorityIntelItem,
  mapToHighPriorityIntelItem,
} from '@/components/recruiting-hub/utils/intelMapping';

const INTEL_POLL_MS = 60_000;

function mergeIntel(targets: RecruitingBoardPlayer[], apiIntel: RecruitingIntelItem[]): HighPriorityIntelItem[] {
  const bySlug = new Map(targets.map((p) => [p.slug, p]));

  if (apiIntel.length) {
    return apiIntel.slice(0, 4).map((intel, i) => {
      const target = bySlug.get(intel.playerId);
      if (target) return mapBoardTargetToHighPriorityIntelItem(target, i, intel);
      return mapToHighPriorityIntelItem(intel, undefined);
    });
  }

  return targets.slice(0, 4).map((p, i) => mapBoardTargetToHighPriorityIntelItem(p, i));
}

export function useIntelFeed(targets: RecruitingBoardPlayer[]): {
  items: HighPriorityIntelItem[];
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

  const items = useMemo(() => mergeIntel(targets, apiIntel), [apiIntel, targets]);

  return { items, loading: loading && items.length === 0, lastUpdated };
}

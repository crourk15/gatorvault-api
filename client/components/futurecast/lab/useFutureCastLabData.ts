'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadFutureCastLabData,
  loadFutureCastLabPrimary,
  loadFutureCastLabSecondaryRaw,
  type FutureCastLabDataMap,
} from '@/lib/futurecast-lab-data';
import { deriveHeatLevel } from '@/lib/api/futurecast';
import { userFacingLoadError } from '@/lib/api-warm-poll';

const LAB_POLL_MS = 90_000;

const EMPTY_LAB_DATA: FutureCastLabDataMap = {
  masterBoard: {
    classYear: 2027,
    updatedAt: '',
    movementHeatmap: { upCount: 0, downCount: 0, flatCount: 0 },
    heatmap: { buckets: [], windowDays: 7 },
    ufConfidenceAverage: 0,
    confidenceSparkline: [],
    commitWatch: [],
    highPriority: { playerIds: [], players: [] },
    movementSummary: {
      risers: [],
      fallers: [],
      highVolatility: [],
      riserPlayers: [],
      fallerPlayers: [],
      volatilePlayers: [],
    },
    players: [],
  },
  trendingBoard: { classYear: 2027, updatedAt: '', trendingUp: [], trendingDown: [] },
  movementIntel: {
    classYear: 2027,
    updatedAt: '',
    movementHeatmap: { upCount: 0, downCount: 0, flatCount: 0 },
    heatmap: { buckets: [], windowDays: 7 },
    risers: [],
    fallers: [],
    highVolatility: [],
    stable: [],
    fitScoreLeaders: [],
    fitScoreRisks: [],
    alerts: [],
  },
  staffNotes: { classYear: 2027, updatedAt: '', totalNotes: 0, count: 0, notes: [] },
  home: {
    classYear: 2027,
    commitSort: 'fit',
    heatmap: { buckets: [], windowDays: 7 },
    commits: [],
    topTargets: [],
    trendingUp: [],
    trendingDown: [],
    portalWatchlist: [],
  },
  stock: { stockUp: [], stockDown: [], windowDays: 7 },
  summary: { classYear: 2027, commitCount: 0, targetCount: 0, nationalRank: null },
  metrics: { avgUFProbability: 0, highPriorityCount: 0, activePredictions: 0 },
  heatLevel: 'warm',
  lastUpdated: null,
  highPriority: [],
  visitIntel: [],
  visitRecap: [],
  flipWatch: [],
  underclassmen: [],
};

export type FutureCastLabData = FutureCastLabDataMap & {
  loading: boolean;
  secondaryLoading: boolean;
  refreshing: boolean;
  warming: boolean;
  error: string | null;
  reload: () => void;
};

export function useFutureCastLabData(): FutureCastLabData {
  const [data, setData] = useState<FutureCastLabDataMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [warming, setWarming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setSecondaryLoading(true);
      setWarming(true);
      setError(null);
    } else {
      setRefreshing(true);
    }
    try {
      if (isInitial) {
        const [primary, secondaryRaw] = await Promise.all([
          loadFutureCastLabPrimary(),
          loadFutureCastLabSecondaryRaw(),
        ]);
        setData({
          ...EMPTY_LAB_DATA,
          ...primary,
          ...secondaryRaw,
          heatLevel: deriveHeatLevel(secondaryRaw.home, secondaryRaw.stock),
          lastUpdated: primary.lastUpdated ?? secondaryRaw.movementIntel.updatedAt ?? null,
        });
        setError(null);
      } else {
        const next = await loadFutureCastLabData();
        setData(next);
        setError(null);
      }
    } catch (err) {
      if (isInitial) {
        setError(userFacingLoadError(err, 'Failed to load FutureCast Lab.'));
      }
    } finally {
      if (isInitial) {
        setLoading(false);
        setSecondaryLoading(false);
        setWarming(false);
      } else {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    void load(true);
    timer = setInterval(() => {
      if (!cancelled) void load(false);
    }, LAB_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  const snapshot = data ?? EMPTY_LAB_DATA;

  return {
    ...snapshot,
    loading,
    secondaryLoading,
    refreshing,
    warming,
    error,
    reload: () => void load(true),
  };
}

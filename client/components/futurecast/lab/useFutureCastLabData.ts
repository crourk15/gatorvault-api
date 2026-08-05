'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadFutureCastLabData,
  loadFutureCastLabPrimary,
  loadFutureCastLabSecondaryRaw,
  applyDiscoverySeasonOverlay,
  type FutureCastLabDataMap,
} from '@/lib/futurecast-lab-data';
import { buildSeedFutureCastLabData } from '@/lib/futurecast-lab-seed';
import { deriveHeatLevel } from '@/lib/api/futurecast';
import { userFacingLoadError } from '@/lib/api-warm-poll';
import {
  HIGH_PRIORITY_YEAR,
  readStaleHighPriorityCache,
  type HighPriorityPlayer,
} from '@/lib/futurecast-high-priority-api';
import { primaryRecruitingClassYear } from '@/lib/recruiting-cycle';

const LAB_POLL_MS = 90_000;
const SEED_LAB_DATA = buildSeedFutureCastLabData();

function hpUfPct(p: HighPriorityPlayer | (HighPriorityPlayer & { ufConfidence?: number | null })): number | null {
  const raw =
    (p as { ufProbability?: number | null }).ufProbability ??
    (p as { ufConfidence?: number | null }).ufConfidence;
  if (raw == null || !Number.isFinite(Number(raw)) || Number(raw) <= 0) return null;
  return Number(raw);
}

function hasUsableUfProbability(players: HighPriorityPlayer[] | undefined): boolean {
  return (players ?? []).some((p) => hpUfPct(p) != null);
}

/** Prefer stale localStorage HP (real UF%) over seed rows that often ship with null odds. */
function initialLabData(): FutureCastLabDataMap | null {
  if (!SEED_LAB_DATA.masterBoard.players.length) return null;
  const discoveryYear = primaryRecruitingClassYear();
  const staleDiscovery = readStaleHighPriorityCache(discoveryYear);
  const staleClosing = readStaleHighPriorityCache(HIGH_PRIORITY_YEAR);
  return {
    ...SEED_LAB_DATA,
    highPriority: hasUsableUfProbability(staleDiscovery?.players)
      ? staleDiscovery!.players
      : SEED_LAB_DATA.highPriority,
    highPriorityClosing: hasUsableUfProbability(staleClosing?.players)
      ? staleClosing!.players
      : SEED_LAB_DATA.highPriorityClosing,
  };
}

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
  highPriorityClosing: [],
  visitIntel: [],
  visitRecap: [],
  flipWatch: [],
  movementNarratives: [],
  underclassmen: [],
  roster: [],
  commits2027: [],
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
  const seedReady = SEED_LAB_DATA.masterBoard.players.length > 0;
  const [data, setData] = useState<FutureCastLabDataMap | null>(() => initialLabData());
  const [loading, setLoading] = useState(!seedReady);
  const [secondaryLoading, setSecondaryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [warming, setWarming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    const hasSeedPaint = SEED_LAB_DATA.masterBoard.players.length > 0;

    if (isInitial) {
      // Seeded first paint — never flip back into fc-elite-loading.
      if (!hasSeedPaint) {
        setLoading(true);
        setWarming(true);
      }
      setSecondaryLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }
    try {
      if (isInitial) {
        // Elite: fire primary + secondary together — do not wait on master-board
        // before kicking off trending / high-priority / movement.
        const primaryPromise = loadFutureCastLabPrimary();
        const secondaryPromise = loadFutureCastLabSecondaryRaw();

        const primary = await primaryPromise;
        if (!primary.masterBoard.players.length && hasSeedPaint) {
          // Keep seed if live primary is empty/cold.
          setSecondaryLoading(false);
          setLoading(false);
          setWarming(false);
          return;
        }
        // Keep usable HP through primary paint — wiping to [] made the 2028 meter
        // fall back to Closing Class board math until secondary landed.
        setData((prev) => {
          const keepHp = hasUsableUfProbability(prev?.highPriority)
            ? prev!.highPriority
            : [];
          const keepHpc = hasUsableUfProbability(prev?.highPriorityClosing)
            ? prev!.highPriorityClosing
            : [];
          const partialOverlay = applyDiscoverySeasonOverlay(primary, {
            trendingBoard: EMPTY_LAB_DATA.trendingBoard,
            movementIntel: EMPTY_LAB_DATA.movementIntel,
            staffNotes: EMPTY_LAB_DATA.staffNotes,
            home: EMPTY_LAB_DATA.home,
            stock: EMPTY_LAB_DATA.stock,
            highPriority: keepHp,
            highPriorityClosing: keepHpc,
            visitIntel: prev?.visitIntel ?? [],
            visitRecap: prev?.visitRecap ?? [],
            flipWatch: prev?.flipWatch ?? [],
            movementNarratives: prev?.movementNarratives ?? [],
            underclassmen: [],
            roster: [],
            commits2027: [],
          });
          return {
            ...EMPTY_LAB_DATA,
            ...primary,
            ...partialOverlay,
            highPriority: keepHp,
            highPriorityClosing: keepHpc,
            heatLevel: 'warm',
            lastUpdated: primary.lastUpdated,
          };
        });
        setLoading(false);
        setWarming(false);

        const secondaryRaw = await secondaryPromise;
        const discoveryOverlay = applyDiscoverySeasonOverlay(primary, secondaryRaw);
        setData({
          ...EMPTY_LAB_DATA,
          ...primary,
          ...secondaryRaw,
          ...discoveryOverlay,
          heatLevel: deriveHeatLevel(secondaryRaw.home, secondaryRaw.stock),
          lastUpdated: primary.lastUpdated ?? secondaryRaw.movementIntel.updatedAt ?? null,
        });
        setError(null);
      } else {
        const next = await loadFutureCastLabData();
        if (!next.masterBoard.players.length && hasSeedPaint) return;
        setData(next);
        setError(null);
      }
    } catch (err) {
      if (isInitial && !hasSeedPaint) {
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

  const snapshot = data ?? (seedReady ? SEED_LAB_DATA : EMPTY_LAB_DATA);

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

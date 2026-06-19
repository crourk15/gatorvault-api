/**
 * FutureCast Lab — prediction-engine data map (FutureCast APIs only).
 */
import { fetchFutureCastHome, type FutureCastHomeResponse } from './futurecast-home-api';
import {
  fetchFutureCastMasterBoard,
  fetchFutureCastMovementIntel,
  fetchFutureCastStaffNotesBoard,
  fetchFutureCastTrendingBoard,
} from './futurecast-board-api';
import type {
  MasterBoardResponse,
  MovementIntelResponse,
  StaffNotesResponse,
  TrendingBoardResponse,
} from './futurecast-board-types';
import type { FutureCastHeatLevel, FutureCastHeroMetrics, FutureCastPageSummary } from './api/futurecast';
import { deriveHeatLevel } from './api/futurecast';
import { fetchStockBoard, type StockBoardResponse } from './predictions-api';
import { fetchHighPriorityTargets, type HighPriorityPlayer } from './futurecast-high-priority-api';
import { fetchRecruitingBoard } from './recruiting-board-api';
import type { RecruitingBoardPlayer } from './recruiting-board-api';

const EMPTY_STOCK: StockBoardResponse = { stockUp: [], stockDown: [], windowDays: 7 };

export type FutureCastLabDataMap = {
  masterBoard: MasterBoardResponse;
  trendingBoard: TrendingBoardResponse;
  movementIntel: MovementIntelResponse;
  staffNotes: StaffNotesResponse;
  home: FutureCastHomeResponse;
  stock: StockBoardResponse;
  summary: FutureCastPageSummary;
  metrics: FutureCastHeroMetrics;
  heatLevel: FutureCastHeatLevel;
  lastUpdated: string | null;
  highPriority: HighPriorityPlayer[];
  underclassmen: RecruitingBoardPlayer[];
};

function buildSummary(master: MasterBoardResponse): FutureCastPageSummary {
  return {
    classYear: master.classYear,
    commitCount: master.commitWatch.length,
    targetCount: master.players.length,
    nationalRank: null,
  };
}

function buildMetrics(master: MasterBoardResponse): FutureCastHeroMetrics {
  return {
    avgUFProbability: Math.round(master.ufConfidenceAverage ?? 0),
    highPriorityCount: master.highPriority.players.length,
    activePredictions: master.players.length,
  };
}

export async function loadFutureCastLabData(): Promise<FutureCastLabDataMap> {
  const [master, trending, movement, staffNotes, home, stock, highPriority, board28] = await Promise.all([
    fetchFutureCastMasterBoard(),
    fetchFutureCastTrendingBoard(),
    fetchFutureCastMovementIntel(),
    fetchFutureCastStaffNotesBoard(),
    fetchFutureCastHome(),
    fetchStockBoard().catch(() => EMPTY_STOCK),
    fetchHighPriorityTargets().catch(() => ({
      players: [],
      classYear: 2027,
      count: 0,
      updatedAt: new Date().toISOString(),
    })),
    fetchRecruitingBoard(2028).catch(() => null),
  ]);

  return {
    masterBoard: master,
    trendingBoard: trending,
    movementIntel: movement,
    staffNotes,
    home,
    stock,
    summary: buildSummary(master),
    metrics: buildMetrics(master),
    heatLevel: deriveHeatLevel(home, stock),
    lastUpdated: master.updatedAt ?? movement.updatedAt ?? null,
    highPriority: highPriority.players ?? [],
    underclassmen: board28?.targets ?? [],
  };
}

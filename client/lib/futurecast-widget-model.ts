/**
 * Normalizes live FutureCast API payloads into homepage widget view models.
 */
import type {
  FeedPredictionWithHistory,
  FutureCastClassResponse,
  FutureCastHomeResponse,
  FutureCastPredictionsResponse,
  FutureCastWidgetBundle,
} from './futurecast-home-api';
import { FUTURECAST_WIDGET_YEAR } from './futurecast-home-api';
import type { PredictorLeaderboardEntry } from './predictions-api';

export interface WidgetPredictor {
  name: string;
  score: number;
}

export interface WidgetProspectCard {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  movementDelta: number;
  confidence: number;
  topPredictors: WidgetPredictor[];
  trendHistory: number[];
  year: typeof FUTURECAST_WIDGET_YEAR;
}

export interface WidgetClassSummary {
  classImpactScore: number | null;
  teamImpactScore: number | null;
  nationalRank: number | null;
  secRank: number | null;
  blueChipRatio: number | null;
  inStatePercentage: number;
  year: typeof FUTURECAST_WIDGET_YEAR;
}

export interface FutureCastWidgetView {
  topProspect: WidgetProspectCard | null;
  classSummary: WidgetClassSummary;
  trending: WidgetProspectCard[];
  updatedAt: string | null;
}

function toPredictors(entries: PredictorLeaderboardEntry[], limit = 3): WidgetPredictor[] {
  return entries.slice(0, limit).map((p) => ({
    name: p.name,
    score: p.hits + p.misses > 0 ? Math.round(p.hitRate * 100) : 0,
  }));
}

function trendValues(row: FeedPredictionWithHistory | undefined): number[] {
  if (!row?.trendHistory?.length) return [];
  return row.trendHistory.map((p) => p.confidence);
}

function findPredictionHistory(
  playerId: string,
  predictions: FeedPredictionWithHistory[]
): FeedPredictionWithHistory | undefined {
  return predictions.find((p) => p.playerId === playerId);
}

function toProspectCard(
  row: FeedPredictionWithHistory,
  globalPredictors: WidgetPredictor[],
  historySource?: FeedPredictionWithHistory
): WidgetProspectCard {
  const history = historySource ?? row;
  return {
    playerId: row.playerId,
    playerName: row.fullName,
    position: row.position || '—',
    team: row.school || row.committedTo || 'Uncommitted',
    movementDelta: row.delta ?? 0,
    confidence: row.confidence ?? 0,
    topPredictors: globalPredictors,
    trendHistory: trendValues(history),
    year: FUTURECAST_WIDGET_YEAR,
  };
}

function pickTopProspect(
  home: FutureCastHomeResponse,
  predictions: FeedPredictionWithHistory[],
  globalPredictors: WidgetPredictor[]
): WidgetProspectCard | null {
  const candidate =
    home.topTargets?.[0] ??
    home.trendingUp?.[0] ??
    predictions[0] ??
    null;
  if (!candidate) return null;
  const history = findPredictionHistory(candidate.playerId, predictions);
  return toProspectCard(candidate, globalPredictors, history ?? candidate);
}

function buildClassSummary(classData: FutureCastClassResponse): WidgetClassSummary {
  const commits = classData.commitCount ?? 0;
  const blueChips = classData.blueChips ?? 0;
  return {
    classImpactScore: classData.classImpactScore,
    teamImpactScore: classData.teamImpactScore,
    nationalRank: classData.rankings?.nationalRank ?? null,
    secRank: classData.rankings?.secRank ?? null,
    blueChipRatio: commits > 0 ? Math.round((blueChips / commits) * 100) : null,
    inStatePercentage: classData.inStatePct ?? 0,
    year: FUTURECAST_WIDGET_YEAR,
  };
}

export function buildFutureCastWidgetView(bundle: FutureCastWidgetBundle): FutureCastWidgetView {
  const globalPredictors = toPredictors(bundle.predictions.predictors ?? []);
  const predictions = bundle.predictions.predictions ?? [];

  const trending = predictions.slice(0, 6).map((row) => toProspectCard(row, globalPredictors, row));

  return {
    topProspect: pickTopProspect(bundle.home, predictions, globalPredictors),
    classSummary: buildClassSummary(bundle.classData),
    trending,
    updatedAt: bundle.classData.rankings?.updatedAt ?? null,
  };
}

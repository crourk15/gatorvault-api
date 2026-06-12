/**
 * Mount FutureCast Predictions API.
 */
import type { Express } from 'express';
import { handleListPredictions } from './index';
import { handleGetPlayerPredictions } from './player/[id]';
import { handleGetPredictorLeaderboard } from '../predictors/leaderboard';

export function mountFutureCastPredictionsRoutes(app: Express): void {
  app.get('/api/predictions/player/:id', handleGetPlayerPredictions);
  app.get('/api/predictions', handleListPredictions);
  app.get('/api/predictors/leaderboard', handleGetPredictorLeaderboard);
}

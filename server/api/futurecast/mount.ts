/**
 * Mount FutureCast feature routes (/api/futurecast/*).
 */
import type { Express } from 'express';
import { handleGetStockBoard } from './stock';
import { handleGetMovementSnapshots } from './snapshots';
import { handleGetMovementHeatmap } from './heatmap';

import { handleGetFutureCastHome } from './home';
import { handleGetFutureCastClass } from './class';
import { handleGetFutureCastPredictions } from './predictions-route';
import { handleGetFutureCastCommits, handleGetFutureCastTargets } from './commits-targets';
import { handleGetFutureCastBigBoard } from './big-board-route';

export function mountFutureCastFeatureRoutes(app: Express): void {
  app.get('/api/futurecast/home', handleGetFutureCastHome);
  app.get('/api/futurecast/class', handleGetFutureCastClass);
  app.get('/api/futurecast/predictions', handleGetFutureCastPredictions);
  app.get('/api/futurecast/commits', handleGetFutureCastCommits);
  app.get('/api/futurecast/targets', handleGetFutureCastTargets);
  app.get('/api/futurecast/big-board', handleGetFutureCastBigBoard);
  app.get('/api/futurecast/stock', handleGetStockBoard);
  app.get('/api/futurecast/snapshots', handleGetMovementSnapshots);
  app.get('/api/futurecast/heatmap', handleGetMovementHeatmap);
  app.get('/api/futurecast/movement', handleGetMovementHeatmap);
}

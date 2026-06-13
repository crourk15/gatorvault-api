/**
 * Mount FutureCast feature routes (/api/futurecast/*).
 */
import type { Express } from 'express';
import { handleGetStockBoard } from './stock';
import { handleGetMovementSnapshots } from './snapshots';
import { handleGetMovementHeatmap } from './heatmap';

export function mountFutureCastFeatureRoutes(app: Express): void {
  app.get('/api/futurecast/stock', handleGetStockBoard);
  app.get('/api/futurecast/snapshots', handleGetMovementSnapshots);
  app.get('/api/futurecast/heatmap', handleGetMovementHeatmap);
}

/**
 * Mount FutureCast feature routes (/api/futurecast/*).
 */
import type { Express } from 'express';
import { handleGetStockBoard } from './stock';

export function mountFutureCastFeatureRoutes(app: Express): void {
  app.get('/api/futurecast/stock', handleGetStockBoard);
}

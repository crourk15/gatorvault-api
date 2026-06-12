/**
 * Mount FutureCast UF Fit API.
 */
import type { Express } from 'express';
import { handleGetUfFitWatchlist } from './watchlist';
import { handleGetUfFitIntel } from './[id]';

export function mountFutureCastUfFitRoutes(app: Express): void {
  app.get('/api/uf-fit/watchlist', handleGetUfFitWatchlist);
  app.get('/api/uf-fit/:id', handleGetUfFitIntel);
}

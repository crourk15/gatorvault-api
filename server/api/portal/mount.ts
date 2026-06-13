/**
 * Mount FutureCast Portal Intelligence API.
 */
import type { Express } from 'express';
import { handleGetPortalWatchlist } from './watchlist';
import { handleGetPortalPlayers } from './players';
import { handleGetPortalPlayerBySlug } from './player-slug';
import { handleGetPortalPredictions } from './predictions';

export function mountFutureCastPortalRoutes(app: Express): void {
  app.get('/api/portal/watchlist', handleGetPortalWatchlist);
  app.get('/api/portal/players', handleGetPortalPlayers);
  app.get('/api/portal/players/:slug', handleGetPortalPlayerBySlug);
  app.get('/api/portal/predictions/:id', handleGetPortalPredictions);
}

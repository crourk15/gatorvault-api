/**
 * Mount FutureCast Players API routes on Express.
 * @see server/docs/futurecast-platform-spec.md §3.1
 */
import type { Express } from 'express';
import { handleListPlayers } from './index';
import { handleGetPlayerById } from './[id]';
import { handleGetPlayerBySlug } from './slug/[slug]';
import { handleGetPlayerProfiles } from './[id]/profiles';
import { handleGetPlayerSignals } from './[id]/signals';
import { handleGetRelatedPlayers } from './[id]/related';

export function mountFutureCastPlayersRoutes(app: Express): void {
  app.get('/api/players', handleListPlayers);
  app.get('/api/players/slug/:slug', handleGetPlayerBySlug);
  app.get('/api/players/:id/profiles', handleGetPlayerProfiles);
  app.get('/api/players/:id/signals', handleGetPlayerSignals);
  app.get('/api/players/:id/related', handleGetRelatedPlayers);
  app.get('/api/players/:id', handleGetPlayerById);
}

/**
 * Aggregated player profile + slug resolve routes.
 */
import type { Express } from 'express';
import { handleGetFullProfile } from './full-profile/[slug]';
import { handleResolvePlayerSlug } from './resolve/[slug]';

export function mountPlayerProfileRoutes(app: Express): void {
  app.get('/api/player/full-profile/:slug', handleGetFullProfile);
  app.get('/api/player/resolve/:slug', handleResolvePlayerSlug);
}

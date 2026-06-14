/**
 * Mount /api/recruits routes.
 */
import type { Express } from 'express';
import { handleRecruitsParam, handleRecruitsRoot } from './index';

export function mountRecruitsRoutes(app: Express): void {
  app.get('/api/recruits', handleRecruitsRoot);
  app.get('/api/recruits/:param', handleRecruitsParam);
}

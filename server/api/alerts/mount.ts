/**
 * Mount FutureCast alerts routes.
 */
import type { Express } from 'express';
import { handleListAlerts } from './index';

export function mountFutureCastAlertsRoutes(app: Express): void {
  app.get('/api/alerts', handleListAlerts);
}

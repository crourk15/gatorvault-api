/**
 * Mount staff-only FutureCast dashboard routes.
 */
import type { Express } from 'express';
import { handleGetStaffDashboard } from './dashboard';

export function mountStaffRoutes(app: Express): void {
  app.get('/api/staff/dashboard', handleGetStaffDashboard);
}

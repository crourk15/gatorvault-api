/**
 * Mount FutureCast Big Board API.
 */
import type { Express } from 'express';
import { handleGetBigBoard } from './index';

export function mountFutureCastBigBoardRoutes(app: Express): void {
  app.get('/api/big-board', handleGetBigBoard);
}

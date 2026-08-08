/**
 * GET /api/futurecast/master-board — elite master board payload.
 *
 * iOS Lab primary depends on this route. Never leave members on status:building
 * when a disk/HP soft plate exists (Tier B GET no-sync).
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { buildMasterBoardPayload } from './allowlist-board';
import {
  sendCachedJson,
  masterBoardCacheKey,
  loadMasterBoardCached,
  primeFuturecastCache,
  softMasterBoardFromHighPriority,
  writeMasterBoardRuntime,
} from './response-cache';

export const handleGetFutureCastMasterBoard = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const primed = loadMasterBoardCached();
    if (primed != null) {
      primeFuturecastCache(masterBoardCacheKey(), primed);
      res.setHeader('X-GatorVault-Cache', 'DISK');
      res.json(primed);
      return;
    }

    await sendCachedJson(res, masterBoardCacheKey(), async () => {
      const payload = await buildMasterBoardPayload();
      writeMasterBoardRuntime(payload);
      return payload;
    }, {
      softOnDeferred: () => softMasterBoardFromHighPriority(),
      backgroundBuildOnSoft: true,
    });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

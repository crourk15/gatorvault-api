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
  isHpPlateFresh,
  scheduleMasterBoardDiskRebuild,
  stampMasterBoardForFans,
} from './response-cache';

export const handleGetFutureCastMasterBoard = asyncHandler(async (_req: Request, res: Response) => {
  try {
    const primed = loadMasterBoardCached();
    if (primed != null) {
      primeFuturecastCache(masterBoardCacheKey(), primed);
      const fresh = isHpPlateFresh(primed);
      // Do not let iOS URLCache keep an Aug-stale Lab stamp.
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      if (fresh) {
        res.setHeader('X-GatorVault-Cache', 'DISK');
        res.json(primed);
      } else {
        // Stale Aug-seed disk: serve immediately, restamp from live HP for the
        // Lab hero, and rebuild so the plate itself does not stay frozen.
        scheduleMasterBoardDiskRebuild(() => buildMasterBoardPayload());
        res.setHeader('X-GatorVault-Cache', 'DISK-STALE');
        res.json(stampMasterBoardForFans(primed));
      }
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

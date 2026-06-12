/**
 * GET /api/players/:id/profiles — all profiles for a player.
 */
import type { Request, Response } from 'express';
import { getPlayerById } from '../../../models/player';
import { getHighSchoolProfileByPlayerId } from '../../../models/highschool-profile';
import { getCollegeProfileByPlayerId } from '../../../models/college-profile';
import { getPortalProfileByPlayerId } from '../../../models/portal-profile';
import { getUFSpecificProfileByPlayerId } from '../../../models/uf-specific-profile';
import {
  asyncHandler,
  handleApiError,
  isUuid,
  sendError,
  serializeProfile,
} from '../utils';

export const handleGetPlayerProfiles = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isUuid(id)) {
      sendError(res, 400, 'Invalid UUID');
      return;
    }

    const player = await getPlayerById(id);
    if (!player) {
      sendError(res, 404, 'Player not found');
      return;
    }

    const [highSchoolProfile, collegeProfile, portalProfile, ufSpecificProfile] = await Promise.all([
      getHighSchoolProfileByPlayerId(id),
      getCollegeProfileByPlayerId(id),
      getPortalProfileByPlayerId(id),
      getUFSpecificProfileByPlayerId(id),
    ]);

    res.json({
      highSchoolProfile: serializeProfile(
        highSchoolProfile as unknown as Record<string, unknown> | null
      ),
      collegeProfile: serializeProfile(collegeProfile as unknown as Record<string, unknown> | null),
      portalProfile: serializeProfile(portalProfile as unknown as Record<string, unknown> | null),
      ufSpecificProfile: serializeProfile(
        ufSpecificProfile as unknown as Record<string, unknown> | null
      ),
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

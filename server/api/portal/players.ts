/**
 * GET /api/portal/players — portal lifecycle only.
 */
import type { Request, Response } from 'express';
import { listPortalCandidates } from '../../models/portal-intel';
import {
  asyncHandler,
  handlePortalApiError,
  parseLimit,
  parseOptionalInt,
  parsePosition,
} from './utils-api';

function hasUfInterest(ufStatus: string | null | undefined, ufFitScore: number | null | undefined): boolean {
  if (ufStatus && String(ufStatus).toUpperCase() !== 'NONE') return true;
  return (ufFitScore ?? 0) > 0;
}

export const handleGetPortalPlayers = asyncHandler(async (req: Request, res: Response) => {
  try {
    const class_year = parseOptionalInt(req.query.class_year, 'class_year');
    const position = parsePosition(req.query.position);
    const limit = parseLimit(req.query.limit, 200, 500);
    const ufOnly = req.query.ufInterest !== '0';

    const rows = await listPortalCandidates({ class_year, position });
    const players = rows
      .filter((row) => !ufOnly || hasUfInterest(row.uf_status, row.uf_fit_score))
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        slug: row.slug,
        fullName: row.full_name,
        position: row.position,
        classYear: row.class_year,
        lifecycle: 'PORTAL' as const,
        ufInterest: hasUfInterest(row.uf_status, row.uf_fit_score),
        ufFitScore: row.uf_fit_score,
        previousSchool: row.previous_school,
      }));

    res.json({
      lifecycle: 'PORTAL',
      count: players.length,
      empty: players.length === 0,
      message: players.length === 0 ? 'No players found for this category yet.' : undefined,
      players,
    });
  } catch (err) {
    handlePortalApiError(res, err);
  }
});

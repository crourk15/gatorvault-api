/**
 * GET /api/recruits — default 2027 class list.
 * GET /api/recruits/:param — class year (2027) or recruit slug/id.
 */
import type { Request, Response } from 'express';
import { asyncHandler, handlePredictionsApiError } from '../predictions/utils-api';
import { FUTURECAST_CLASS_YEAR } from '../futurecast/eligibility';
import { sendCachedJson } from '../futurecast/response-cache';
import { getRecruitById, listRecruitsForClassYear } from './engine';

const CLASS_YEAR_RE = /^20\d{2}$/;

function parseClassYear(raw: string): number | null {
  if (!CLASS_YEAR_RE.test(raw)) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

async function respondClassYear(res: Response, classYear: number): Promise<void> {
  const cacheKey = `recruits:class:${classYear}`;
  await sendCachedJson(res, cacheKey, async () => {
    const payload = await listRecruitsForClassYear(classYear);
    return {
      ok: true,
      ...payload,
      count: payload.recruits.length,
    };
  });
}

export const handleRecruitsRoot = asyncHandler(async (_req: Request, res: Response) => {
  try {
    await respondClassYear(res, FUTURECAST_CLASS_YEAR);
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

export const handleRecruitsParam = asyncHandler(async (req: Request, res: Response) => {
  try {
    const param = decodeURIComponent(String(req.params.param || req.params.classYear || req.params.id || ''));
    const classYear = parseClassYear(param);

    if (classYear != null) {
      await respondClassYear(res, classYear);
      return;
    }

    const recruit = await getRecruitById(param);
    if (!recruit) {
      res.status(404).json({ ok: false, error: 'Not found' });
      return;
    }

    res.json({ ok: true, recruit });
  } catch (err) {
    handlePredictionsApiError(res, err);
  }
});

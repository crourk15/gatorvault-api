/**
 * Predictions tab — players with UF commit probability.
 * @see server/docs/futurecast-platform-spec.md §3.2 Predictions tab, §1.5 uf_commit_probability
 */
import type { Request, Response } from 'express';

export interface PredictionsQuery {
  class_year: number;
  min_probability?: number;
}

export async function getPredictions(_query: PredictionsQuery): Promise<unknown[]> {
  throw new Error('TODO: getPredictions — spec §3.2 Predictions tab');
}

export async function handlePredictions(req: Request, res: Response): Promise<void> {
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handlePredictions' });
}

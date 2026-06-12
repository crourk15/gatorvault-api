/**
 * Movement Tracker — recent score/status changes.
 * @see server/docs/futurecast-platform-spec.md §3.2 Movement Tracker tab, §4.1
 */
import type { Request, Response } from 'express';

export interface MovementTrackerQuery {
  class_year?: number;
  since_days?: number;
}

export interface MovementEvent {
  player_id: string;
  field: string;
  old_value: unknown;
  new_value: unknown;
  changed_at: string;
}

export async function getMovementEvents(_query: MovementTrackerQuery): Promise<MovementEvent[]> {
  throw new Error('TODO: getMovementEvents — spec §4.1 Movement Tracker');
}

export async function handleMovementTracker(req: Request, res: Response): Promise<void> {
  void req;
  res.status(501).json({ ok: false, error: 'TODO: handleMovementTracker' });
}

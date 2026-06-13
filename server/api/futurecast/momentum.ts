/**
 * FutureCast momentum — blend MODEL window delta with recent discovery signals.
 */
import { db } from '../../models/db';
import type { StockBoardRow } from '../../models/predictions';

const SIGNAL_BOOST: Record<string, number> = {
  OFFER: 3,
  RANKING_JUMP: 5,
  CAMP_PERFORMANCE: 3,
  SOCIAL_MOMENTUM: 6,
  STAFF_FLAG: 4,
  EVALUATION_NOTE: 2,
  PORTAL_ACTIVITY: 1,
  OTHER: 1,
};

export async function loadSignalMomentumBoosts(
  windowDays: number,
  playerIds?: string[]
): Promise<Map<string, number>> {
  const boosts = new Map<string, number>();
  const days = Math.max(1, Math.floor(windowDays));
  const params: unknown[] = [days];
  let playerFilter = '';

  if (playerIds?.length) {
    params.push(playerIds);
    playerFilter = ` AND player_id = ANY($2::uuid[])`;
  }

  try {
    const { rows } = await db.query<{ player_id: string; signal_type: string; cnt: string }>(
      `
      SELECT player_id, signal_type::text, COUNT(*)::text AS cnt
      FROM futurecast.discovery_signals
      WHERE created_at >= NOW() - ($1::int || ' days')::interval
      ${playerFilter}
      GROUP BY player_id, signal_type
      `,
      params
    );

    for (const row of rows) {
      const perSignal = SIGNAL_BOOST[row.signal_type] ?? 1;
      const boost = perSignal * parseInt(row.cnt, 10);
      boosts.set(row.player_id, (boosts.get(row.player_id) ?? 0) + boost);
    }
  } catch {
    /* signals optional when DB unavailable */
  }

  return boosts;
}

export type EnrichedStockRow = StockBoardRow & {
  momentum_boost: number;
  base_window_delta: number;
};

export function applyMomentumBoosts(
  rows: StockBoardRow[],
  boosts: Map<string, number>
): EnrichedStockRow[] {
  return rows.map((row) => {
    const boost = boosts.get(row.player_id) ?? 0;
    const base = row.window_delta ?? 0;
    return {
      ...row,
      base_window_delta: base,
      momentum_boost: boost,
      window_delta: base + boost,
    };
  });
}

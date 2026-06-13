/**
 * FutureCast alerts — confidence movement and volatility spikes.
 */
import { db } from './db';

export const FUTURECAST_ALERTS_TABLE = 'futurecast.alerts';

export interface AlertRow {
  id: string;
  player_id: string;
  type: string;
  message: string;
  created_at: string;
  seen: boolean;
  full_name?: string;
  slug?: string;
}

export interface Alert {
  id: string;
  playerId: string;
  playerName: string;
  playerSlug: string;
  type: string;
  message: string;
  createdAt: string;
  seen: boolean;
}

export function alertFromRow(row: AlertRow): Alert {
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: row.full_name ?? 'Unknown player',
    playerSlug: row.slug ?? row.player_id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at,
    seen: row.seen,
  };
}

export async function createAlert(
  playerId: string,
  type: string,
  message: string
): Promise<void> {
  await db.query(
    `
    INSERT INTO ${FUTURECAST_ALERTS_TABLE} (player_id, type, message)
    VALUES ($1, $2, $3)
    `,
    [playerId, type, message]
  );
}

export async function listAlerts(limit = 50): Promise<Alert[]> {
  const capped = Math.min(Math.max(limit, 1), 200);
  const { rows } = await db.query<AlertRow>(
    `
    SELECT
      a.id,
      a.player_id,
      a.type,
      a.message,
      a.created_at,
      a.seen,
      p.full_name,
      p.slug
    FROM ${FUTURECAST_ALERTS_TABLE} a
    JOIN futurecast.players p ON p.id = a.player_id
    ORDER BY a.created_at DESC
    LIMIT $1
    `,
    [capped]
  );
  return rows.map(alertFromRow);
}

const CONFIDENCE_MOVEMENT_THRESHOLD = 5;
const VOLATILITY_SPIKE_THRESHOLD = 20;

export async function checkAndCreateMovementAlerts(input: {
  playerId: string;
  oldConfidence: number;
  newConfidence: number;
  oldVolatility: number;
  newVolatility: number;
}): Promise<void> {
  const confidenceDelta = Math.abs(input.newConfidence - input.oldConfidence);
  if (confidenceDelta >= CONFIDENCE_MOVEMENT_THRESHOLD) {
    await createAlert(
      input.playerId,
      'confidence_movement',
      `Confidence moved from ${input.oldConfidence}% → ${input.newConfidence}%`
    );
  }

  const volatilityDelta = input.newVolatility - input.oldVolatility;
  if (volatilityDelta >= VOLATILITY_SPIKE_THRESHOLD) {
    await createAlert(
      input.playerId,
      'volatility_spike',
      `Volatility spiked from ${input.oldVolatility} → ${input.newVolatility}`
    );
  }
}

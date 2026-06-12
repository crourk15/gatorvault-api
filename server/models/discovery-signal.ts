/**
 * DiscoverySignal repository — insert-only + list against futurecast.discovery_signals.
 * @see server/docs/futurecast-platform-spec.md §1.6
 * @see server/migrations/006_create_discovery_signals_table.sql
 */
import { db } from './db';
import {
  FUTURECAST_DISCOVERY_SIGNALS_TABLE,
  type DiscoverySignal,
  type DiscoverySignalInsert,
  type DiscoverySignalRow,
  discoverySignalFromRow,
  discoverySignalToRow,
} from './discovery-signal-types';

export * from './discovery-signal-types';

const TABLE = FUTURECAST_DISCOVERY_SIGNALS_TABLE;

export async function insertDiscoverySignal(
  data: DiscoverySignalInsert
): Promise<DiscoverySignal> {
  const row = discoverySignalToRow(data);
  const columns = Object.keys(row);
  if (columns.length === 0) {
    throw new Error('insertDiscoverySignal requires at least one field');
  }

  const values = columns.map((col) => row[col]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const { rows } = await db.query<DiscoverySignalRow>(
    `
    INSERT INTO ${TABLE} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
    `,
    values
  );

  return discoverySignalFromRow(rows[0]);
}

/** @deprecated Use insertDiscoverySignal */
export const createDiscoverySignal = insertDiscoverySignal;

export async function listDiscoverySignalsByPlayerId(
  playerId: string,
  limit?: number
): Promise<DiscoverySignal[]> {
  const params: unknown[] = [playerId];
  let limitClause = '';

  if (limit != null) {
    const capped = Math.min(Math.max(limit, 1), 500);
    params.push(capped);
    limitClause = ` LIMIT $${params.length}`;
  }

  const { rows } = await db.query<DiscoverySignalRow>(
    `
    SELECT *
    FROM ${TABLE}
    WHERE player_id = $1
    ORDER BY created_at DESC
    ${limitClause}
    `,
    params
  );

  return rows.map(discoverySignalFromRow);
}

/** @deprecated Use listDiscoverySignalsByPlayerId */
export const listSignalsByPlayerId = listDiscoverySignalsByPlayerId;

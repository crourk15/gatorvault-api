/**
 * DiscoverySignal types and row mappers (FutureCast).
 * @see server/docs/futurecast-platform-spec.md §1.6
 * @see server/migrations/006_create_discovery_signals_table.sql
 */

import { SIGNAL_TYPE, type SignalType } from '../shared/enums';

export type { SignalType };
export const SIGNAL_TYPES = SIGNAL_TYPE;

export const FUTURECAST_DISCOVERY_SIGNALS_TABLE = 'futurecast.discovery_signals';

export interface DiscoverySignal {
  id: string;
  player_id: string;
  signal_type: SignalType;
  signal_value: Record<string, unknown>;
  created_at: string;
}

export type DiscoverySignalInsert = Omit<DiscoverySignal, 'id' | 'created_at'>;

/** Immutable log — updates are not supported. */
export type DiscoverySignalUpdate = never;

export type DiscoverySignalRow = {
  id: string;
  player_id: string;
  signal_type: string;
  signal_value: Record<string, unknown> | null;
  created_at: string;
};

function assertSignalType(value: string): SignalType {
  if ((SIGNAL_TYPES as readonly string[]).includes(value)) {
    return value as SignalType;
  }
  throw new Error(`Invalid signal type: ${value}`);
}

export function discoverySignalFromRow(row: DiscoverySignalRow): DiscoverySignal {
  return {
    id: row.id,
    player_id: row.player_id,
    signal_type: assertSignalType(row.signal_type),
    signal_value: row.signal_value ?? {},
    created_at: row.created_at,
  };
}

export function discoverySignalToRow(signal: DiscoverySignalInsert): Record<string, unknown> {
  return {
    player_id: signal.player_id,
    signal_type: signal.signal_type,
    signal_value: signal.signal_value ?? {},
  };
}

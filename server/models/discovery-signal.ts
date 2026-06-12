/**
 * DiscoverySignal — Early Discovery event log.
 * @see server/docs/futurecast-platform-spec.md §1.6
 */

export type SignalType =
  | 'varsity_as_freshman'
  | 'camp_mvp'
  | 'combine_result'
  | '7v7_performance'
  | 'coach_quote'
  | 'local_media'
  | 'social_buzz';

export interface DiscoverySignal {
  id: string;
  player_id: string;
  signal_type: SignalType;
  source: string;
  value: Record<string, unknown>;
  score_impact: number;
  created_at: string;
}

export async function createDiscoverySignal(_signal: Omit<DiscoverySignal, 'id' | 'created_at'>): Promise<DiscoverySignal> {
  throw new Error('TODO: implement createDiscoverySignal — spec §2.1 step 2');
}

export async function listSignalsByPlayerId(_playerId: string, _limit?: number): Promise<DiscoverySignal[]> {
  throw new Error('TODO: implement listSignalsByPlayerId — spec §3.1 GET /players/:id');
}

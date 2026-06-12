/**
 * Discovery signal creation + dedupe.
 * @see server/docs/futurecast-platform-spec.md §1.6, §2.1 step 2
 */
import type { SignalType } from '../../../models/discovery-signal';

export interface SignalEventInput {
  playerId: string;
  signalType: SignalType;
  source: string;
  value: Record<string, unknown>;
  scoreImpact: number;
}

export function dedupeKey(input: SignalEventInput): string {
  // TODO(Phase 2): hash playerId + signalType + normalized source
  return `${input.playerId}:${input.signalType}:${input.source}`;
}

export async function createSignalFromEvent(_input: SignalEventInput): Promise<{ created: boolean }> {
  // TODO(Phase 2): insert DiscoverySignal if dedupeKey not seen
  throw new Error('TODO: createSignalFromEvent');
}

export function scoreImpactForType(_signalType: SignalType, _value: Record<string, unknown>): number {
  // TODO(Phase 2): map signal_type → default score_impact ranges — spec §1.6
  throw new Error('TODO: scoreImpactForType');
}

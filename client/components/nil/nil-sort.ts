import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { parseNilValuationK } from '@/components/recruiting-hub/NILTrackerSection/nil-player-utils';

export type NilLeaderboardTab = 'top' | 'rising' | 'targets' | 'portal';

export function sortNilPlayers(players: HighPriorityPlayer[], tab: NilLeaderboardTab): HighPriorityPlayer[] {
  const rows = [...players];
  switch (tab) {
    case 'rising':
      return rows.sort((a, b) => (b.delta7d ?? b.movementDelta ?? 0) - (a.delta7d ?? a.movementDelta ?? 0));
    case 'targets':
      return rows.sort(
        (a, b) => (b.fitScore ?? b.staffConfidence ?? 0) - (a.fitScore ?? a.staffConfidence ?? 0)
      );
    case 'portal':
      return rows
        .filter((p) => Math.abs(p.movementDelta ?? 0) >= 2 || Math.abs(p.delta7d ?? 0) >= 3)
        .sort((a, b) => Math.abs(b.movementDelta ?? 0) - Math.abs(a.movementDelta ?? 0));
    case 'top':
    default:
      return rows.sort((a, b) => parseNilValuationK(b) - parseNilValuationK(a));
  }
}

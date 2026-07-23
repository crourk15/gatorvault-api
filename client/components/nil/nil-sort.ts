import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { parseNilValuationK } from '@/components/recruiting-hub/NILTrackerSection/nil-player-utils';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';

export type NilLeaderboardTab = 'top' | 'rising' | 'targets' | 'movers';

export function sortNilPlayers(players: HighPriorityPlayer[], tab: NilLeaderboardTab): HighPriorityPlayer[] {
  const rows = [...players];
  switch (tab) {
    case 'rising':
      return rows.sort((a, b) => (b.delta7d ?? b.movementDelta ?? 0) - (a.delta7d ?? a.movementDelta ?? 0));
    case 'targets':
      // Active UF board only — not every high-priority name.
      return rows
        .filter((p) => isActiveUfTarget(p))
        .sort((a, b) => (b.fitScore ?? b.staffConfidence ?? 0) - (a.fitScore ?? a.staffConfidence ?? 0));
    case 'movers': {
      // Board movement (FutureCast %), not transfer-portal players.
      const mag = (p: HighPriorityPlayer) => {
        const d7 = Math.abs(p.delta7d ?? 0);
        const md = Math.abs(p.movementDelta ?? 0);
        return Math.max(d7, md);
      };
      return rows.filter((p) => mag(p) >= 3).sort((a, b) => mag(b) - mag(a));
    }
    case 'top':
    default:
      return rows.sort((a, b) => parseNilValuationK(b) - parseNilValuationK(a));
  }
}

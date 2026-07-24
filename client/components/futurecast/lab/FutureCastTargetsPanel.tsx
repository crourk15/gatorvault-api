'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FutureCastTargetCard } from '@/components/futurecast/FutureCastTargetCard';
import { FutureCastPanelShell } from './primitives';
import {
  futureCastPlayerToLabTarget,
  highPriorityToLabTarget,
  movementDeltasAreBelievable,
} from './fc-lab-types';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';
import { isActiveUfTarget } from '@/lib/recruiting-target-filters';
import { closingClassUrgencyScore, isClosingClassInPlayTarget } from './competing-schools';
import { FutureCastBattlesPanel } from './FutureCastBattlesPanel';
import { FutureCastFlipWatchPanel } from './FutureCastFlipWatchPanel';
import type { FlipWatchRow } from '@/lib/futurecast-high-priority-api';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard?: TrendingBoardResponse;
  highPriority?: HighPriorityPlayer[];
  flipWatch?: FlipWatchRow[];
  bare?: boolean;
  /** When true, nest battles tabs under the target cards (default). */
  includeBattles?: boolean;
  /** Compact chase strip under targets (default true). */
  battlesCompact?: boolean;
};

export function FutureCastTargetsPanel({
  masterBoard,
  trendingBoard,
  highPriority = [],
  flipWatch = [],
  bare,
  includeBattles = true,
  battlesCompact = true,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  const rows = useMemo(() => {
    if (discoveryFocus && highPriority.length) {
      return [...highPriority]
        .filter((p) => isActiveUfTarget(p))
        .filter((p) => Number(p.classYear) === focusYear)
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
        .slice(0, 10)
        .map(highPriorityToLabTarget);
    }
    return [...masterBoard.players]
      .filter((p) => isActiveUfTarget(p))
      .map(futureCastPlayerToLabTarget)
      .filter(isClosingClassInPlayTarget)
      .sort((a, b) => closingClassUrgencyScore(b) - closingClassUrgencyScore(a))
      .slice(0, 10);
  }, [discoveryFocus, highPriority, masterBoard.players, focusYear]);

  const showMovement = useMemo(() => movementDeltasAreBelievable(rows), [rows]);

  const title = discoveryFocus ? `${focusYear} UF Targets` : 'Top UF Targets';
  const sub = discoveryFocus
    ? "Florida's priority board — odds, fit, and who's still in play."
    : 'In-play closing fights — Florida odds, rival threats, and movement.';

  return (
    <FutureCastPanelShell bare={bare} title={title} sub={sub} testId="fc-lab-targets">
      {rows.length === 0 ? (
        <p className="rh-cc-empty">
          {discoveryFocus ? `No ${focusYear} UF targets loaded.` : 'No master board targets loaded.'}
        </p>
      ) : (
        <div className="fc-lab-target-cards">
          {rows.map((p) => (
            <FutureCastTargetCard
              key={p.slug}
              player={p}
              profileHref={playerProfileRoute(p.slug, 'futurecast')}
              showMovement={showMovement}
            />
          ))}
        </div>
      )}

      {!discoveryFocus && flipWatch.length > 0 ? (
        <div className="fc-lab-targets-flip-watch">
          <FutureCastFlipWatchPanel bare flipWatch={flipWatch} />
        </div>
      ) : null}

      {includeBattles && trendingBoard ? (
        <div className="fc-lab-targets-battles">
          <FutureCastBattlesPanel
            bare
            compact={battlesCompact}
            masterBoard={masterBoard}
            trendingBoard={trendingBoard}
            highPriority={highPriority}
          />
        </div>
      ) : null}
    </FutureCastPanelShell>
  );
}

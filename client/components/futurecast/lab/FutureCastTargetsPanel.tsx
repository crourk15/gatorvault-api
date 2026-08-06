'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute, RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';
import { FutureCastTargetCard } from '@/components/futurecast/FutureCastTargetCard';
import { FutureCastChaseCard } from './FutureCastChaseCard';
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
import { FutureCastLeadingPanel } from './FutureCastLeadingPanel';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

type Props = {
  masterBoard: MasterBoardResponse;
  trendingBoard?: TrendingBoardResponse;
  highPriority?: HighPriorityPlayer[];
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

  const title = discoveryFocus ? `${focusYear} Priority chase` : 'Top UF Targets';
  const sub = discoveryFocus
    ? 'Ranked by chase heat — why Florida should fight for them, not who leads the board today.'
    : 'In-play closing fights — Florida odds, rival threats, and movement.';

  const boardHref = discoveryFocus
    ? RECRUITING_TAB_PATHS['targets-2028']
    : RECRUITING_TAB_PATHS['targets-2027'];
  const boardAction = (
    <VaultNavLink href={boardHref} className="fc-lab-panel-board-link" data-testid="fc-lab-open-board">
      Open {focusYear} board →
    </VaultNavLink>
  );

  return (
    <>
      <FutureCastLeadingPanel
        bare={bare}
        masterBoard={masterBoard}
        trendingBoard={trendingBoard}
        highPriority={highPriority}
      />
      <FutureCastPanelShell
        bare={bare}
        title={title}
        sub={sub}
        action={boardAction}
        testId="fc-lab-targets"
      >
        {rows.length === 0 ? (
          <p className="rh-cc-empty">
            {discoveryFocus ? `No ${focusYear} UF targets loaded.` : 'No master board targets loaded.'}
          </p>
        ) : discoveryFocus ? (
          <div className="fc-lab-chase-list" data-testid="fc-lab-chase-list">
            {rows.map((p, i) => (
              <FutureCastChaseCard
                key={p.slug}
                player={p}
                rank={i + 1}
                showMovement={showMovement}
              />
            ))}
          </div>
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
    </>
  );
}

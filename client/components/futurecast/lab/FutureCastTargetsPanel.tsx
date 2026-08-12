'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse, TrendingBoardResponse } from '@/lib/futurecast-board-types';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { UnderclassmenPlayer } from '@/lib/futurecast-underclassmen-api';
import { playerProfileRoute, RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';
import { FutureCastTargetCard } from '@/components/futurecast/FutureCastTargetCard';
import { HighPriorityTargetCard } from '@/components/futurecast/HighPriorityTargetCard';
import { FutureCastPanelShell } from './primitives';
import {
  futureCastPlayerToLabTarget,
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
  underclassmen?: UnderclassmenPlayer[];
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
  underclassmen = [],
  bare,
  includeBattles = true,
  battlesCompact = true,
}: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  /** Same ranked HP rows the recruiting chase board uses — full VaultChaseCard. */
  const chasePlayers = useMemo(() => {
    if (!discoveryFocus || !highPriority.length) return [] as HighPriorityPlayer[];
    return [...highPriority]
      .filter((p) => isActiveUfTarget(p))
      .filter((p) => Number(p.classYear) === focusYear)
      .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
      .slice(0, 5);
  }, [discoveryFocus, highPriority, focusYear]);

  const closingRows = useMemo(() => {
    if (discoveryFocus) return [];
    return [...masterBoard.players]
      .filter((p) => isActiveUfTarget(p))
      .map(futureCastPlayerToLabTarget)
      .filter(isClosingClassInPlayTarget)
      .sort((a, b) => closingClassUrgencyScore(b) - closingClassUrgencyScore(a))
      .slice(0, 10);
  }, [discoveryFocus, masterBoard.players]);

  const showMovement = useMemo(() => {
    if (discoveryFocus) {
      return movementDeltasAreBelievable(
        chasePlayers.map((p) => ({
          delta7d: p.delta7d ?? p.movementDelta ?? null,
        }))
      );
    }
    return movementDeltasAreBelievable(closingRows);
  }, [discoveryFocus, chasePlayers, closingRows]);

  const title = discoveryFocus ? `${focusYear} Priority chase` : 'Top UF Targets';
  const sub = discoveryFocus
    ? 'Same full chase cards as the board — heat, fit, why we chase. Open board for the rest of the class.'
    : 'In-play closing fights — Florida odds, rival threats, and movement.';

  const boardHref = discoveryFocus
    ? RECRUITING_TAB_PATHS['targets-2028']
    : RECRUITING_TAB_PATHS['targets-2027'];
  const boardAction = (
    <VaultNavLink href={boardHref} className="fc-lab-panel-board-link" data-testid="fc-lab-open-board">
      Open {focusYear} board →
    </VaultNavLink>
  );

  // Chase surface must not sit inside overflow:hidden ModuleShell chrome — that
  // plus flex max-height was clipping VaultChaseCard to the top row on iOS.
  const chaseBare = discoveryFocus ? true : bare;

  return (
    <>
      <FutureCastLeadingPanel
        bare={bare}
        masterBoard={masterBoard}
        trendingBoard={trendingBoard}
        highPriority={highPriority}
        underclassmen={underclassmen}
      />
      <FutureCastPanelShell
        bare={chaseBare}
        title={title}
        sub={sub}
        action={boardAction}
        testId="fc-lab-targets"
      >
        {discoveryFocus ? (
          chasePlayers.length === 0 ? (
            <p className="rh-cc-empty">No {focusYear} UF targets loaded.</p>
          ) : (
            <div
              className="gv-hp-board-grid fc-lab-chase-board"
              data-testid="fc-lab-chase-list"
              data-show-movement={showMovement ? '1' : '0'}
            >
              {chasePlayers.map((player, i) => (
                <HighPriorityTargetCard
                  key={player.slug}
                  player={player}
                  rank={i + 1}
                  showMovement={showMovement}
                  profileContext="futurecast"
                />
              ))}
            </div>
          )
        ) : closingRows.length === 0 ? (
          <p className="rh-cc-empty">No master board targets loaded.</p>
        ) : (
          <div className="fc-lab-target-cards">
            {closingRows.map((p) => (
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

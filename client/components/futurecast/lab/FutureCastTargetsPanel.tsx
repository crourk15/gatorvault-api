'use client';

import React, { useMemo } from 'react';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
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

type Props = {
  masterBoard: MasterBoardResponse;
  highPriority?: HighPriorityPlayer[];
  bare?: boolean;
};

export function FutureCastTargetsPanel({ masterBoard, highPriority = [], bare }: Props): React.ReactElement {
  const { discoveryView: discoveryFocus } = useFutureCastLabCycle();
  const focusYear = discoveryFocus ? 2028 : 2027;

  const rows = useMemo(() => {
    if (discoveryFocus && highPriority.length) {
      return [...highPriority]
        .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
        .slice(0, 10)
        .map(highPriorityToLabTarget);
    }
    return [...masterBoard.players]
      .filter((p) => isActiveUfTarget(p))
      .sort((a, b) => (b.ufConfidence ?? -1) - (a.ufConfidence ?? -1))
      .slice(0, 10)
      .map(futureCastPlayerToLabTarget);
  }, [discoveryFocus, highPriority, masterBoard.players]);

  const showMovement = useMemo(() => movementDeltasAreBelievable(rows), [rows]);

  const title = discoveryFocus
    ? `${focusYear} UF Targets — Allowlist Board`
    : 'Top UF Targets — Master Board';
  const sub = discoveryFocus
    ? 'Locked UF targets ranked by priority score, Florida odds, and fit during early discovery.'
    : 'Premium FutureCast master board with probability, movement, fit, and competing schools.';

  return (
    <FutureCastPanelShell
      bare={bare}
      title={title}
      sub={sub}
      testId="fc-lab-targets"
    >
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
    </FutureCastPanelShell>
  );
}

'use client';

import React from 'react';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { FutureCastTargetCard } from '@/components/futurecast/FutureCastTargetCard';
import { FutureCastPanelShell } from './primitives';
import { futureCastPlayerToLabTarget } from './fc-lab-types';

type Props = {
  masterBoard: MasterBoardResponse;
  bare?: boolean;
};

export function FutureCastTargetsPanel({ masterBoard, bare }: Props): React.ReactElement {
  const rows = [...masterBoard.players]
    .filter((p) => {
      const committed = p.committedTo ?? '';
      return !committed || !/\bflorida\b|\bgators\b/i.test(String(committed));
    })
    .sort((a, b) => b.ufConfidence - a.ufConfidence)
    .slice(0, 10)
    .map(futureCastPlayerToLabTarget);

  return (
    <FutureCastPanelShell
      bare={bare}
      title="Top UF Targets — Master Board"
      sub="Premium FutureCast master board with probability, movement, fit, and competing schools."
      testId="fc-lab-targets"
    >
      {rows.length === 0 ? (
        <p className="rh-cc-empty">No master board targets loaded.</p>
      ) : (
        <div className="fc-lab-target-cards">
          {rows.map((p) => (
            <FutureCastTargetCard
              key={p.slug}
              player={p}
              profileHref={playerProfileRoute(p.slug, 'futurecast')}
            />
          ))}
        </div>
      )}
    </FutureCastPanelShell>
  );
}

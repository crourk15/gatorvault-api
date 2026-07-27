'use client';

import React from 'react';
import type { FcLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { ufPctFromFc } from '@/components/futurecast/lab/fc-lab-types';
import {
  CompetingSchoolsBar,
  FitScoreBadge,
  MovementBadge,
  UfProbBar,
} from '@/components/futurecast/lab/primitives';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

export type FutureCastTargetCardProps = {
  player: FcLabTarget;
  profileHref: string;
  /** When false, hide weekly Δ badges (uniform filler board). */
  showMovement?: boolean;
};

/** Premium target card used by FutureCast Lab master board sections. */
export function FutureCastTargetCard({
  player,
  profileHref,
  showMovement = true,
}: FutureCastTargetCardProps): React.ReactElement {
  const rpmFromPredictors = (player.predictors ?? []).find(
    (x) => x?.name && /on3\s*rpm/i.test(String(x.name)) && Number(x.score) > 0
  );
  const pctRaw =
    player.ufProbability != null && Number(player.ufProbability) > 0
      ? player.ufProbability
      : player.ufRpmPct != null && Number(player.ufRpmPct) > 0
        ? player.ufRpmPct
        : rpmFromPredictors
          ? Number(rpmFromPredictors.score)
          : player.ufProbability;
  const pct = ufPctFromFc(pctRaw);
  const delta = showMovement ? Math.round(player.delta7d ?? 0) : 0;
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';
  const hasWeekChange = showMovement && delta !== 0;

  return (
    <article className="fc-lab-target-card fc-target-card" data-testid="fc-target-card">
      <header className="fc-target-header fc-lab-target-card__head">
        <div>
          <VaultNavLink href={profileHref} className="fc-lab-target-card__name">
            {player.name}
          </VaultNavLink>
          <p className="fc-lab-target-card__meta">
            {player.position} · {player.school ?? '—'} · Class {player.classYear}
          </p>
        </div>
        {hasWeekChange ? <MovementBadge delta={delta} tone={tone} /> : null}
      </header>

      <div className="fc-target-body">
        <div className="fc-lab-target-card__prob">
          <span className="fc-lab-target-card__prob-label">Florida odds</span>
          <UfProbBar value={pct} />
        </div>
        <CompetingSchoolsBar player={player} />
        <div className="fc-lab-target-card__badges">
          <FitScoreBadge score={player.fitScore} />
        </div>
      </div>
    </article>
  );
}

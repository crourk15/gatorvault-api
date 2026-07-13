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
  const pct = ufPctFromFc(player.ufProbability);
  const delta = showMovement ? Math.round(player.delta7d ?? 0) : 0;
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';
  const hasWeekChange = showMovement && delta !== 0;

  return (
    <article className="fc-lab-target-card fc-target-card" data-testid="fc-target-card">
      <header className="fc-target-header fc-lab-target-card__head">
        <div>
          <a href={profileHref} className="fc-lab-target-card__name">
            {player.name}
          </a>
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

'use client';

import React from 'react';
import type { FcLabTarget } from '@/components/futurecast/lab/fc-lab-types';
import { ufPctFromFc } from '@/components/futurecast/lab/fc-lab-types';
import {
  AnalystConfidenceMeter,
  CompetingSchoolsBar,
  FitScoreBadge,
  MovementBadge,
  MovementSparkline,
  UfProbBar,
} from '@/components/futurecast/lab/primitives';

export type FutureCastTargetCardProps = {
  player: FcLabTarget;
  profileHref: string;
};

/** Premium target card used by FutureCast Lab master board sections. */
export function FutureCastTargetCard({ player, profileHref }: FutureCastTargetCardProps): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = Math.round(player.delta7d ?? 0);
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';

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
        <MovementBadge delta={delta} tone={tone} />
      </header>

      <div className="fc-target-body">
        <div className="fc-lab-target-card__prob">
          <UfProbBar value={pct} />
        </div>
        <div className="fc-lab-target-card__spark">
          <MovementSparkline end={pct} delta={delta} />
          <span className="fc-lab-target-card__spark-label">7-day UF probability</span>
        </div>
        <CompetingSchoolsBar player={player} />
        <div className="fc-lab-target-card__badges">
          <FitScoreBadge score={player.fitScore} />
          <AnalystConfidenceMeter value={player.modelPct} label="FutureCast Model" />
        </div>
      </div>

      <footer className="fc-target-footer fc-lab-target-card__foot">
        <a href={profileHref} className="fc-target-link fc-lab-target-card__cta">
          More Intel →
        </a>
      </footer>
    </article>
  );
}

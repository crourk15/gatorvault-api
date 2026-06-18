'use client';

import React from 'react';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import { playerProfileRoute } from '@/lib/vault-route-map';
import {
  AnalystConfidenceMeter,
  CompetingSchoolsBar,
  FitScoreBadge,
  ModuleShell,
  MovementBadge,
  MovementSparkline,
  UfProbBar,
} from './primitives';
import { futureCastPlayerToLabTarget, type FcLabTarget, ufPctFromFc } from './fc-lab-types';

type Props = {
  masterBoard: MasterBoardResponse;
};

function TargetCard({ player }: { player: FcLabTarget }): React.ReactElement {
  const pct = ufPctFromFc(player.ufProbability);
  const delta = Math.round(player.delta7d);
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';

  return (
    <article className="fc-lab-target-card" data-testid="fc-lab-target-card">
      <header className="fc-lab-target-card__head">
        <div>
          <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-target-card__name">
            {player.name}
          </a>
          <p className="fc-lab-target-card__meta">
            {player.position} · {player.school ?? '—'} · Class {player.classYear}
          </p>
        </div>
        <MovementBadge delta={delta} tone={tone} />
      </header>

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

      <footer className="fc-lab-target-card__foot">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-target-card__cta">
          More Intel →
        </a>
      </footer>
    </article>
  );
}

export function FutureCastTargetsPanel({ masterBoard }: Props): React.ReactElement {
  const rows = [...masterBoard.players]
    .sort((a, b) => b.ufConfidence - a.ufConfidence)
    .slice(0, 10)
    .map(futureCastPlayerToLabTarget);

  return (
    <ModuleShell
      title="Top UF Targets — Master Board"
      sub="Premium FutureCast master board with probability, movement, fit, and competing schools."
      testId="fc-lab-targets"
    >
      {rows.length === 0 ? (
        <p className="rh-cc-empty">No master board targets loaded.</p>
      ) : (
        <div className="fc-lab-target-cards">
          {rows.map((p) => (
            <TargetCard key={p.slug} player={p} />
          ))}
        </div>
      )}
    </ModuleShell>
  );
}

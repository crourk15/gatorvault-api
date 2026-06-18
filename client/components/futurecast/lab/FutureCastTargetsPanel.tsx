'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import { HIGH_PRIORITY_YEAR } from '@/lib/futurecast-high-priority-api';
import { playerProfileRoute } from '@/lib/vault-route-map';
import { analystConfidence } from '@/components/recruiting-hub/FutureCastSection/futurecast-player-utils';
import {
  AnalystConfidenceMeter,
  CompetingSchoolsBar,
  FitScoreBadge,
  ModuleShell,
  MovementBadge,
  MovementSparkline,
  UfProbBar,
  ufPctFromRaw,
} from './primitives';

type Props = {
  players: HighPriorityPlayer[];
};

function TargetCard({ player }: { player: HighPriorityPlayer }): React.ReactElement {
  const pct = ufPctFromRaw(player.ufProbability);
  const delta = Math.round(player.delta7d ?? player.movementDelta ?? 0);
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';
  const classYear = player.classYear ?? HIGH_PRIORITY_YEAR;
  const predictors = player.predictors?.slice(0, 2) ?? [];
  const predictorLine =
    predictors.length > 0
      ? predictors
          .map((p) => `${p.name} ${Math.round(p.score <= 1 ? p.score * 100 : p.score)}%`)
          .join(', ')
      : null;

  return (
    <article className="fc-lab-target-card" data-testid="fc-lab-target-card">
      <header className="fc-lab-target-card__head">
        <div>
          <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-target-card__name">
            {player.name}
          </a>
          <p className="fc-lab-target-card__meta">
            {player.position} · {player.school ?? '—'} · Class {classYear}
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
        <AnalystConfidenceMeter
          value={analystConfidence(player) ?? player.staffConfidence}
          label="Analyst confidence"
        />
      </div>

      {predictorLine ? (
        <p className="fc-lab-target-card__predictors">{predictorLine}</p>
      ) : null}

      <footer className="fc-lab-target-card__foot">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-target-card__cta">
          More Intel →
        </a>
      </footer>
    </article>
  );
}

export function FutureCastTargetsPanel({ players }: Props): React.ReactElement {
  const rows = [...players]
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
    .slice(0, 8);

  return (
    <ModuleShell
      title="Top UF Targets"
      sub="Premium FutureCast master board — probability, movement, fit, and competing schools."
      testId="fc-lab-targets"
    >
      {rows.length === 0 ? (
        <p className="rh-cc-empty">No high-priority targets loaded.</p>
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

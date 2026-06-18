'use client';

import React from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { CompetingSchoolDelta } from '@/lib/recruiting-movement-api';
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
  competingDeltas?: CompetingSchoolDelta[];
};

function TargetRow({
  player,
  competingDeltas,
}: {
  player: HighPriorityPlayer;
  competingDeltas?: CompetingSchoolDelta[];
}): React.ReactElement {
  const pct = ufPctFromRaw(player.ufProbability);
  const delta = Math.round(player.delta7d ?? player.movementDelta ?? 0);
  const tone = delta > 0 ? 'rise' : delta < 0 ? 'fall' : 'flat';

  return (
    <article className="fc-lab-target-row" data-testid="fc-lab-target-row">
      <div className="fc-lab-target-row__identity">
        <a href={playerProfileRoute(player.slug, 'futurecast')} className="fc-lab-target-row__name">
          {player.name}
        </a>
        <span className="fc-lab-target-row__meta">
          {player.position} · {player.school ?? '—'} · {player.stars != null ? `${player.stars}★` : '—'}
        </span>
        <UfProbBar value={pct} />
      </div>
      <div className="fc-lab-target-row__signals">
        <div className="fc-lab-target-row__movement">
          <MovementSparkline end={pct} delta={delta} />
          <MovementBadge delta={delta} tone={tone} />
        </div>
        <FitScoreBadge score={player.fitScore} />
        <AnalystConfidenceMeter value={analystConfidence(player) ?? player.staffConfidence} />
        <CompetingSchoolsBar player={player} deltas={competingDeltas} />
      </div>
    </article>
  );
}

export function FutureCastTargetsPanel({ players, competingDeltas }: Props): React.ReactElement {
  const rows = [...players]
    .sort((a, b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0))
    .slice(0, 10);

  return (
    <ModuleShell
      title="Top UF Targets"
      sub="Highest-priority FutureCast targets ranked by UF probability, fit, and priority score."
      action={
        <a href="/vault/futurecast" className="rh-cc-link">
          Full board →
        </a>
      }
      testId="fc-lab-targets"
    >
      {rows.length === 0 ? (
        <p className="rh-cc-empty">No high-priority targets loaded.</p>
      ) : (
        <div className="fc-lab-target-list">
          {rows.map((p) => (
            <TargetRow key={p.slug} player={p} competingDeltas={competingDeltas} />
          ))}
        </div>
      )}
    </ModuleShell>
  );
}

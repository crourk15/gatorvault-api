'use client';

import React, { useEffect, useState } from 'react';
import type { HighPriorityPlayer } from '@/lib/futurecast-high-priority-api';
import type { CompetingSchoolDelta } from '@/lib/recruiting-movement-api';

export {
  ModuleShell,
  MovementSparkline,
  MovementBadge,
  UfProbBar,
  ufPctFromRaw,
} from '@/components/recruiting-hub/command-center/primitives';

export function CompetingSchoolsBar({
  player,
  deltas,
}: {
  player: HighPriorityPlayer;
  deltas?: CompetingSchoolDelta[];
}): React.ReactElement {
  const playerDeltas = (deltas ?? []).filter((d) => d.slug === player.slug || d.playerId === player.id);
  const schools =
    playerDeltas.length > 0
      ? playerDeltas.slice(0, 4).map((d) => ({ name: d.school, rank: d.rankNow }))
      : (player.predictors ?? []).slice(0, 4).map((p) => ({ name: p.name, rank: Math.round(p.score <= 1 ? p.score * 100 : p.score) }));

  if (!schools.length) {
    return <span className="fc-lab-compete fc-lab-compete--empty">No competing schools tracked</span>;
  }

  const max = Math.max(...schools.map((s) => s.rank), 1);

  return (
    <div className="fc-lab-compete" aria-label="Competing schools">
      {schools.map((s) => (
        <div key={s.name} className="fc-lab-compete__row">
          <span className="fc-lab-compete__school">{s.name}</span>
          <div className="fc-lab-compete__track">
            <div className="fc-lab-compete__fill" style={{ width: `${Math.round((s.rank / max) * 100)}%` }} />
          </div>
          <span className="fc-lab-compete__rank">{s.rank}%</span>
        </div>
      ))}
    </div>
  );
}

function fitBand(score: number): 'elite' | 'strong' | 'moderate' | 'low' {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'low';
}

export function FitScoreBadge({
  score,
  label = 'UF Fit',
}: {
  score: number | null | undefined;
  label?: string;
}): React.ReactElement {
  if (score == null) {
    return <span className="fc-lab-fit fc-lab-fit--na">—</span>;
  }
  const pct = score <= 1 ? Math.round(score * 100) : Math.round(score);
  return (
    <span className={`fc-lab-fit fc-lab-fit--${fitBand(pct)}`} data-testid="fc-lab-fit-badge">
      {label} {pct}
    </span>
  );
}

export function AnalystConfidenceMeter({
  value,
  label = 'Analyst confidence',
}: {
  value: number | null | undefined;
  label?: string;
}): React.ReactElement {
  const pct = value == null ? 0 : value <= 1 ? Math.round(value * 100) : Math.round(value);
  const tone = pct >= 67 ? 'high' : pct >= 34 ? 'mid' : 'low';

  return (
    <div className="fc-lab-analyst" aria-label={`${label} ${pct}%`}>
      <span className="fc-lab-analyst__label">{label}</span>
      <div className="fc-lab-analyst__track">
        <div className={`fc-lab-analyst__fill fc-lab-analyst__fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-lab-analyst__value">{value == null ? '—' : `${pct}%`}</span>
    </div>
  );
}

export function UfProbabilityBarHero({
  value,
  delta7d,
  label = 'Commit Likelihood',
}: {
  value: number;
  delta7d: number;
  label?: string;
}): React.ReactElement {
  const [animated, setAnimated] = useState(0);
  const pct = Math.max(0, Math.min(100, value));
  const tone = pct >= 67 ? 'high' : pct >= 34 ? 'mid' : 'low';
  const trend = delta7d > 0 ? 'up' : delta7d < 0 ? 'down' : 'flat';

  useEffect(() => {
    const t = window.setTimeout(() => setAnimated(pct), 80);
    return () => window.clearTimeout(t);
  }, [pct]);

  return (
    <div className="fc-lab-meter" data-testid="fc-lab-uf-meter">
      <p className="fc-lab-meter__label">{label}</p>
      <div className={`fc-lab-meter__ring fc-lab-meter__ring--${tone}`}>
        <svg viewBox="0 0 120 120" className="fc-lab-meter__svg" aria-hidden>
          <circle cx="60" cy="60" r="52" className="fc-lab-meter__track" />
          <circle
            cx="60"
            cy="60"
            r="52"
            className={`fc-lab-meter__arc fc-lab-meter__arc--${tone}`}
            strokeDasharray={`${(animated / 100) * 327} 327`}
          />
        </svg>
        <div className="fc-lab-meter__center">
          <span className="fc-lab-meter__value">{pct}%</span>
          <span className="fc-lab-meter__hint">Top targets</span>
        </div>
      </div>
      <p className={`fc-lab-meter__trend fc-lab-meter__trend--${trend}`}>
        Trending {delta7d > 0 ? '↑' : delta7d < 0 ? '↓' : '→'} {delta7d > 0 ? '+' : ''}
        {delta7d}% (7d)
      </p>
    </div>
  );
}

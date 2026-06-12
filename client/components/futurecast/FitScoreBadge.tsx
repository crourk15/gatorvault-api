/**
 * UF Fit Score™ badge — fan-facing name spec §5
 * @see server/docs/futurecast-platform-spec.md §4.1, §5
 */
import React from 'react';

export interface FitScoreBadgeProps {
  score: number;
  label?: string;
}

function band(score: number): 'elite' | 'strong' | 'moderate' | 'low' {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'strong';
  if (score >= 50) return 'moderate';
  return 'low';
}

export function FitScoreBadge({ score, label = 'UF Fit Score' }: FitScoreBadgeProps): React.ReactElement {
  return (
    <span className={`fc-fit-badge fc-fit-badge--${band(score)}`} data-testid="fit-score-badge">
      {label}: {score}
    </span>
  );
}

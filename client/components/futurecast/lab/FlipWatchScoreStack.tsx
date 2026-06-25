'use client';

import React from 'react';
import type { FlipWatchRow } from '@/lib/futurecast-high-priority-api';

type Props = {
  row: Pick<FlipWatchRow, 'flipScore' | 'flipScoreLabel' | 'flipScoreStack'>;
  compact?: boolean;
};

function tierClass(label?: string | null): string {
  const key = String(label || '').toLowerCase();
  if (key === 'hot') return 'fc-flip-score--hot';
  if (key === 'warm') return 'fc-flip-score--warm';
  if (key === 'watch') return 'fc-flip-score--watch';
  return 'fc-flip-score--low';
}

function ScoreBar({ label, value }: { label: string; value: number }): React.ReactElement {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="fc-flip-score__bar">
      <span className="fc-flip-score__bar-label">{label}</span>
      <div className="fc-flip-score__bar-track">
        <div className="fc-flip-score__bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="fc-flip-score__bar-val">{pct}</span>
    </div>
  );
}

export function FlipWatchScoreStack({ row, compact = false }: Props): React.ReactElement | null {
  if (row.flipScore == null || !row.flipScoreStack) return null;

  return (
    <div className={`fc-flip-score ${compact ? 'fc-flip-score--compact' : ''}`} data-testid="fc-flip-score-stack">
      <div className="fc-flip-score__head">
        <span className={`fc-flip-score__pill ${tierClass(row.flipScoreLabel)}`}>
          Flip {row.flipScore}
          {row.flipScoreLabel ? ` · ${row.flipScoreLabel}` : ''}
        </span>
      </div>
      {!compact ? (
        <div className="fc-flip-score__stack">
          <ScoreBar label="UF" value={row.flipScoreStack.uf} />
          <ScoreBar label="OV" value={row.flipScoreStack.visit} />
          <ScoreBar label="Rival" value={row.flipScoreStack.rival} />
          <ScoreBar label="Beat" value={row.flipScoreStack.beat} />
        </div>
      ) : null}
    </div>
  );
}
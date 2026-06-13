/**
 * Confidence bar — 0–100 fill for MODEL pick scores.
 */
import React from 'react';

export interface ConfidenceBarProps {
  value: number;
}

export function ConfidenceBar({ value }: ConfidenceBarProps): React.ReactElement {
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className="fc-confidence-bar" data-testid="confidence-bar">
      <div className="fc-confidence-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

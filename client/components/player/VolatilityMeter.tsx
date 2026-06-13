/**
 * Recruitment volatility score — std dev of confidence over 14 days.
 */
import React from 'react';

export interface VolatilityMeterProps {
  score: number | null | undefined;
}

function volatilityTone(score: number): 'stable' | 'moderate' | 'volatile' {
  if (score < 20) return 'stable';
  if (score < 50) return 'moderate';
  return 'volatile';
}

export function VolatilityMeter({ score }: VolatilityMeterProps): React.ReactElement {
  const value = Math.min(100, Math.max(0, score ?? 0));
  const tone = volatilityTone(value);

  return (
    <div className="fc-volatility-meter" data-testid="volatility-meter">
      <h2 className="fc-volatility-meter__title">Volatility Score</h2>
      <div className="fc-volatility-meter__score-row">
        <span className={`fc-volatility-meter__dot fc-volatility-meter__dot--${tone}`} />
        <span className="fc-volatility-meter__score">{value}</span>
      </div>
      <p className="fc-volatility-meter__hint">
        Measures how unstable this recruitment is over the last 14 days.
      </p>
    </div>
  );
}

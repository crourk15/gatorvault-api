/**
 * UF Fit Score category breakdown — scheme, culture, staff, need, geo.
 */
import React from 'react';

export interface FitScoreBreakdownData {
  scheme: number;
  culture: number;
  staff: number;
  need: number;
  geo: number;
}

export interface FitScoreBreakdownProps {
  fit: FitScoreBreakdownData | null | undefined;
}

const CATEGORIES: { key: keyof FitScoreBreakdownData; label: string }[] = [
  { key: 'scheme', label: 'Scheme Fit' },
  { key: 'culture', label: 'Culture Fit' },
  { key: 'staff', label: 'Staff Connection' },
  { key: 'need', label: 'Positional Need' },
  { key: 'geo', label: 'Geographic Fit' },
];

export function FitScoreBreakdown({ fit }: FitScoreBreakdownProps): React.ReactElement {
  if (!fit) {
    return (
      <p className="fc-fit-breakdown__empty" data-testid="fit-score-breakdown-empty">
        No fit score data available.
      </p>
    );
  }

  return (
    <div className="fc-fit-breakdown" data-testid="fit-score-breakdown">
      {CATEGORIES.map((cat) => {
        const value = Math.min(100, Math.max(0, fit[cat.key] ?? 0));
        return (
          <div key={cat.key} className="fc-fit-breakdown__row">
            <div className="fc-fit-breakdown__head">
              <span className="fc-fit-breakdown__label">{cat.label}</span>
              <span className="fc-fit-breakdown__value">{value}%</span>
            </div>
            <div className="fc-fit-breakdown__track">
              <div className="fc-fit-breakdown__fill" style={{ width: `${value}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

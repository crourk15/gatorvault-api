'use client';

import React from 'react';
import type { PredictionIntel } from '@/lib/game-week-data';

type Props = {
  prediction: PredictionIntel;
};

export function PredictionPanel({ prediction }: Props): React.ReactElement {
  return (
    <div className="gv-gw-pred-panel" data-testid="gw-prediction-panel">
      <p className="gv-gw-pred-panel__score">{prediction.scoreLine}</p>
      <div className="gv-gw-pred-panel__lines">
        <span>{prediction.spread}</span>
        <span>{prediction.total}</span>
        <span>Model: {prediction.modelPick}</span>
      </div>
      <p style={{ fontSize: '0.8rem', margin: '0.5rem 0 0.25rem' }}>Fan poll — UF win</p>
      <div className="gv-gw-pred-panel__fan-bar">
        <div className="gv-gw-pred-panel__fan-fill" style={{ width: `${prediction.fanUfPct}%` }} />
      </div>
      <p style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>{prediction.fanUfPct}% Gator Nation</p>
      <ul className="gv-gw-pred-panel__experts">
        {prediction.expertPicks.map((e) => (
          <li key={e.source}>
            <strong>{e.source}:</strong> {e.pick}
          </li>
        ))}
      </ul>
      <p style={{ fontSize: '0.75rem', marginTop: '0.75rem' }}>Model confidence</p>
      <div className="gv-gw-pred-panel__confidence-meter">
        <div className="gv-gw-pred-panel__confidence-fill" style={{ width: `${prediction.confidence}%` }} />
      </div>
    </div>
  );
}

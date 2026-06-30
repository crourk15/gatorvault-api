'use client';

import React from 'react';
import type { PredictionIntel } from '@/lib/game-week-data';

type Props = {
  prediction: PredictionIntel;
};

export function PredictionPanel({ prediction }: Props): React.ReactElement {
  return (
    <div className="gv-gw-pred-panel" data-testid="gw-prediction-panel">
      <div className="gv-gw-pred-panel__hero">
        <span className="gv-gw-pred-panel__badge">FutureCast pick</span>
        <p className="gv-gw-pred-panel__score">{prediction.scoreLine}</p>
      </div>
      <div className="gv-gw-pred-panel__lines">
        <span className="gv-gw-pred-panel__spread">{prediction.spread}</span>
        <span>{prediction.total}</span>
      </div>
      <p className="gv-gw-pred-panel__poll-label">Fan poll — UF win</p>
      <div className="gv-gw-pred-panel__fan-bar">
        <div className="gv-gw-pred-panel__fan-fill" style={{ width: `${prediction.fanUfPct}%` }} />
      </div>
      <p className="gv-gw-pred-panel__poll-meta">{prediction.fanUfPct}% Gator Nation</p>
      <ul className="gv-gw-pred-panel__experts">
        {prediction.expertPicks.map((e) => (
          <li key={e.source}>
            <strong>{e.source}:</strong> {e.pick}
          </li>
        ))}
      </ul>
      <p className="gv-gw-pred-panel__confidence-label">Model confidence</p>
      <div className="gv-gw-pred-panel__confidence-meter">
        <div className="gv-gw-pred-panel__confidence-fill" style={{ width: `${prediction.confidence}%` }} />
      </div>
    </div>
  );
}

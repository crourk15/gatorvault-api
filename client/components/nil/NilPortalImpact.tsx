'use client';

import React from 'react';
import type { NilPortalImpactRow } from './useNilEliteData';

type Props = {
  gains: NilPortalImpactRow[];
  losses: NilPortalImpactRow[];
};

function ImpactColumn({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: 'gain' | 'loss';
  rows: NilPortalImpactRow[];
}): React.ReactElement {
  return (
    <div className={`nil-portal-col nil-portal-col--${tone}`}>
      <h3 className="nil-portal-col__title">{title}</h3>
      <ul className="nil-portal-col__list">
        {rows.length === 0 ? (
          <li className="nil-portal-col__empty">No tracked movement in this window.</li>
        ) : (
          rows.map((row) => (
            <li key={row.id} className="nil-portal-col__item">
              <div className="nil-portal-col__head">
                <strong>{row.name}</strong>
                <span className="nil-portal-col__pos">{row.position}</span>
              </div>
              <div className="nil-portal-col__range">{row.range}</div>
              <p className="nil-portal-col__note">{row.note}</p>
              <span className={`nil-portal-col__trend nil-portal-col__trend--${row.trend}`} aria-hidden>
                {row.trend === 'up' ? '↑' : row.trend === 'down' ? '↓' : '→'}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function NilPortalImpact({ gains, losses }: Props): React.ReactElement {
  return (
    <section className="nil-elite-section" data-testid="nil-portal-impact">
      <header className="nil-elite-section__head">
        <div>
          <h2 className="nil-elite-section__title">Portal NIL Impact</h2>
          <p className="nil-elite-section__sub">Players UF gained or lost — estimated NIL ranges and trends.</p>
        </div>
      </header>
      <div className="nil-portal-grid">
        <ImpactColumn title="UF Gained (NIL)" tone="gain" rows={gains} />
        <ImpactColumn title="UF Lost (NIL)" tone="loss" rows={losses} />
      </div>
    </section>
  );
}

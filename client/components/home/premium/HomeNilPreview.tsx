'use client';

import React from 'react';
import type { HomeNilPulse } from '@/lib/vault-home-api';

type Props = {
  data: HomeNilPulse | null;
  loading?: boolean;
};

export function HomeNilPreview({ data, loading }: Props): React.ReactElement {
  if (loading && !data) {
    return (
      <div className="uf-premium-grid uf-premium-grid--3">
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
      </div>
    );
  }

  const commits = data?.commits != null ? String(data.commits) : data?.estPool ?? '—';
  const blueChip =
    data?.blueChipPct != null ? `${data.blueChipPct}%` : data?.movementLabel ?? '—';
  const collective = data?.collective || data?.topEarner || 'Florida Victorious';
  const note = data?.topEarnerNote ?? 'Open NIL Tracker for the full board';

  return (
    <div className="uf-premium-grid uf-premium-grid--3" data-testid="home-nil-preview">
      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">UF commits</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__label">Class on board</span>
          <span className="uf-premium-metric__value">{commits}</span>
        </div>
        <p className="uf-premium-card__body">{data?.movementDelta ?? 'Live recruiting board'}</p>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Blue-chip share</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__label">4★+ commits</span>
          <span className="uf-premium-metric__value">{blueChip}</span>
        </div>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Collective</h3>
        <p className="uf-premium-card__body">
          <strong>{collective}</strong>
          <br />
          {note}
        </p>
      </article>
    </div>
  );
}

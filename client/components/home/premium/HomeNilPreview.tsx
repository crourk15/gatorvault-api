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

  const pool = data?.estPool ?? '—';
  const movement = data?.movementLabel ?? '—';
  const top = data?.topEarner || data?.collective || 'Florida Victorious';
  const note = data?.topEarnerNote ?? 'Open NIL Tracker for full valuations';

  return (
    <div className="uf-premium-grid uf-premium-grid--3" data-testid="home-nil-preview">
      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">UF pool est.</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__label">Annual NIL pool</span>
          <span className="uf-premium-metric__value">{pool}</span>
        </div>
        <p className="uf-premium-card__body">{data?.movementDelta ?? 'Public reporting estimate'}</p>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Market pulse</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__label">Deal / board signal</span>
          <span className="uf-premium-metric__value">{movement}</span>
        </div>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Top roster est.</h3>
        <p className="uf-premium-card__body">
          <strong>{top}</strong>
          <br />
          {note}
        </p>
      </article>
    </div>
  );
}

'use client';

import React from 'react';
import type { HomeNilPulse } from '@/lib/vault-home-api';

type Props = {
  data: HomeNilPulse | null;
  loading?: boolean;
};

function competitivenessGrade(secRank: number): string {
  if (!secRank || secRank <= 0) return 'TBD';
  if (secRank <= 3) return 'A';
  if (secRank <= 6) return 'A-';
  if (secRank <= 10) return 'B+';
  if (secRank <= 12) return 'B';
  return 'B-';
}

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

  const estPool = data?.estPool ?? '—';
  const grade = competitivenessGrade(data?.secRank ?? 0);
  const topMover = data?.topEarner ?? 'Gators Collective';
  const moverNote = data?.topEarnerNote ?? 'Tracking collective activity';
  const movement = `${data?.movementLabel ?? 'Stable'} · ${data?.movementDelta ?? '—'}`;

  return (
    <div className="uf-premium-grid uf-premium-grid--3" data-testid="home-nil-preview">
      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">NIL Valuation</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__value">{estPool}</span>
          <span className="uf-premium-metric__label">Estimated pool</span>
        </div>
        <p className="uf-premium-card__body">{movement}</p>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Competitiveness Grade</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__value">{grade}</span>
          <span className="uf-premium-metric__label">
            SEC rank {data?.secRank ? `#${data.secRank}` : '—'}
          </span>
        </div>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Top NIL Movers</h3>
        <p className="uf-premium-card__body">
          <strong>{topMover}</strong>
          <br />
          {moverNote}
        </p>
      </article>
    </div>
  );
}

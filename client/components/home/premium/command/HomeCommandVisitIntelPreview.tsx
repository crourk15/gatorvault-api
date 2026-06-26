'use client';

import React from 'react';
import type { FlipWatchRow, VisitRecapRow } from '@/lib/futurecast-high-priority-api';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  flipWatch: FlipWatchRow[];
  visitRecap: VisitRecapRow[];
  loading?: boolean;
};

function formatOvRange(row: Pick<VisitRecapRow | FlipWatchRow, 'visitStart' | 'visitEnd'>): string {
  if (!row.visitStart) return '';
  if (row.visitEnd && row.visitEnd !== row.visitStart) {
    return `OV ${row.visitStart}–${row.visitEnd}`;
  }
  return `OV ${row.visitStart}`;
}

export function HomeCommandVisitIntelPreview({
  flipWatch,
  visitRecap,
  loading,
}: Props): React.ReactElement {
  const topFlip = flipWatch[0];
  const topRecap = visitRecap[0];
  const hasRows = Boolean(topFlip || topRecap);

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">Verified Visit Intel</h2>
        <p className="home-wow-section-subtitle">
          GatorVault-confirmed UF official visits and flip momentum.
        </p>
      </div>
      <section className="home-wow-card home-wow-visit-intel" data-testid="home-visit-intel-preview">
        {loading ? (
          <div className="home-wow-skeleton home-wow-skeleton--overlay" aria-hidden="true" />
        ) : !hasRows ? (
          <div className="home-wow-visit-intel__empty">
            <p className="home-wow-empty">No verified UF OVs on the board right now.</p>
            <a href={`${VAULT_PILLAR_ROUTES.futurecast}#visits`} className="home-wow-cta-link">
              Open FutureCast Visit Intel →
            </a>
          </div>
        ) : (
          <>
            <div className="home-wow-visit-intel__stats">
              {flipWatch.length > 0 ? (
                <span className="home-wow-visit-intel__stat">
                  Flip Watch <strong>{flipWatch.length}</strong>
                </span>
              ) : null}
              {visitRecap.length > 0 ? (
                <span className="home-wow-visit-intel__stat">
                  OV Recap <strong>{visitRecap.length}</strong>
                </span>
              ) : null}
            </div>
            <ul className="home-wow-visit-intel__list">
              {topFlip ? (
                <li className="home-wow-visit-intel__row">
                  <span className="home-wow-visit-intel__badge home-wow-visit-intel__badge--flip">
                    Flip
                  </span>
                  <div className="home-wow-visit-intel__body">
                    <p className="home-wow-visit-intel__name">{topFlip.name}</p>
                    <p className="home-wow-visit-intel__meta">
                      {topFlip.committedShort}
                      {topFlip.flipScore != null ? ` · Flip ${topFlip.flipScore}` : ''}
                      {topFlip.ufProbability != null ? ` · UF ${topFlip.ufProbability}%` : ''}
                      {formatOvRange(topFlip) ? ` · ${formatOvRange(topFlip)}` : ''}
                    </p>
                  </div>
                </li>
              ) : null}
              {topRecap ? (
                <li className="home-wow-visit-intel__row">
                  <span className="home-wow-visit-intel__badge home-wow-visit-intel__badge--recap">
                    Recap
                  </span>
                  <div className="home-wow-visit-intel__body">
                    <p className="home-wow-visit-intel__name">{topRecap.name}</p>
                    <p className="home-wow-visit-intel__meta">
                      {formatOvRange(topRecap)}
                      {topRecap.visitSourceLabel ? ` · ${topRecap.visitSourceLabel}` : ''}
                      {topRecap.movementNarrative ? ` · ${topRecap.movementNarrative}` : ''}
                    </p>
                  </div>
                </li>
              ) : null}
            </ul>
            <a href={`${VAULT_PILLAR_ROUTES.futurecast}#visits`} className="home-wow-cta-link">
              Open Visit Intel →
            </a>
          </>
        )}
      </section>
    </>
  );
}
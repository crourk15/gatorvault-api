'use client';

import React from 'react';
import type { FlipWatchRow, MovementNarrativeRow, VisitRecapRow } from '@/lib/futurecast-high-priority-api';
import { formatUfPercentWithLabel } from '@/lib/futurecast-elite-metrics';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  flipWatch: FlipWatchRow[];
  visitRecap: VisitRecapRow[];
  movementNarratives?: MovementNarrativeRow[];
  loading?: boolean;
};

function formatOvRange(row: Pick<VisitRecapRow | FlipWatchRow, 'visitStart' | 'visitEnd'>): string {
  if (!row.visitStart) return '';
  if (row.visitEnd && row.visitEnd !== row.visitStart) {
    return `OV ${row.visitStart}-${row.visitEnd}`;
  }
  return `OV ${row.visitStart}`;
}

function MovementNarrativeLine({ text }: { text?: string | null }): React.ReactElement | null {
  if (!text) return null;
  return <p className="home-wow-visit-intel__narrative">{text}</p>;
}

export function HomeCommandVisitIntelPreview({
  flipWatch,
  visitRecap,
  movementNarratives = [],
  loading,
}: Props): React.ReactElement {
  const topFlip = flipWatch[0];
  const topRecap = visitRecap[0];
  const hasRows = Boolean(topFlip || topRecap || movementNarratives.length > 0);
  const shownSlugs = new Set<string>();
  if (topFlip?.slug) shownSlugs.add(topFlip.slug);
  if (topRecap?.slug) shownSlugs.add(topRecap.slug);
  const extraNarratives = movementNarratives
    .filter((row) => row.movementNarrative && !shownSlugs.has(row.slug))
    .slice(0, 2);

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">Verified Visit Intel</h2>
        <p className="home-wow-section-subtitle">
          GatorVault-confirmed UF official visits, flip momentum, and 7-day UF movement.
        </p>
      </div>
      <section className="home-wow-card home-wow-visit-intel" data-testid="home-visit-intel-preview">
        {loading ? (
          <div className="home-wow-skeleton home-wow-skeleton--overlay" aria-hidden="true" />
        ) : !hasRows ? (
          <div className="home-wow-visit-intel__empty">
            <p className="home-wow-empty">No verified UF OVs on the board right now.</p>
            <a href={`${VAULT_PILLAR_ROUTES.futurecast}#visits`} className="home-wow-cta-link">
              Open FutureCast Visit Intel
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
              {movementNarratives.length > 0 ? (
                <span className="home-wow-visit-intel__stat">
                  Movement <strong>{movementNarratives.length}</strong>
                </span>
              ) : null}
            </div>
            <ul className="home-wow-visit-intel__list">
              {topFlip ? (
                <li className="home-wow-visit-intel__row">
                  <span className="home-wow-visit-intel__badge home-wow-visit-intel__badge--flip">Flip</span>
                  <div className="home-wow-visit-intel__body">
                    <p className="home-wow-visit-intel__name">{topFlip.name}</p>
                    <p className="home-wow-visit-intel__meta">
                      {topFlip.committedShort}
                      {topFlip.flipScore != null ? ` · Flip ${topFlip.flipScore}` : ''}
                      {topFlip.ufProbability != null
                        ? ` · UF ${formatUfPercentWithLabel(topFlip.ufProbability, topFlip.ufProbabilityLabel)}`
                        : ''}
                      {formatOvRange(topFlip) ? ` · ${formatOvRange(topFlip)}` : ''}
                    </p>
                    <MovementNarrativeLine text={topFlip.movementNarrative} />
                  </div>
                </li>
              ) : null}
              {topRecap ? (
                <li className="home-wow-visit-intel__row">
                  <span className="home-wow-visit-intel__badge home-wow-visit-intel__badge--recap">Recap</span>
                  <div className="home-wow-visit-intel__body">
                    <p className="home-wow-visit-intel__name">{topRecap.name}</p>
                    <p className="home-wow-visit-intel__meta">
                      {formatOvRange(topRecap)}
                      {topRecap.visitSourceLabel ? ` · ${topRecap.visitSourceLabel}` : ''}
                      {topRecap.ufProbability != null
                        ? ` · UF ${formatUfPercentWithLabel(topRecap.ufProbability, topRecap.ufProbabilityLabel)}`
                        : ''}
                    </p>
                    <MovementNarrativeLine text={topRecap.movementNarrative} />
                  </div>
                </li>
              ) : null}
              {extraNarratives.map((row) => (
                <li key={row.slug} className="home-wow-visit-intel__row">
                  <span className="home-wow-visit-intel__badge home-wow-visit-intel__badge--movement">7d</span>
                  <div className="home-wow-visit-intel__body">
                    <p className="home-wow-visit-intel__name">{row.name}</p>
                    <MovementNarrativeLine text={row.movementNarrative} />
                  </div>
                </li>
              ))}
            </ul>
            <a href={`${VAULT_PILLAR_ROUTES.futurecast}#visits`} className="home-wow-cta-link">
              Open Visit Intel
            </a>
          </>
        )}
      </section>
    </>
  );
}
'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { playerProfilePath } from '@/lib/player-routes';
import type { MasterBoardResponse } from '@/lib/futurecast-board-types';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { UfPremiumCard, UfPremiumSection } from './primitives';

type Props = {
  futurecast: MasterBoardResponse | null;
  movement: StaffDashboardResponse | null;
  loading?: boolean;
};

function ufPct(raw: number | null | undefined): string {
  if (raw == null) return 'TBD';
  return `${Math.round(raw <= 1 ? raw * 100 : raw)}%`;
}

export function FutureCastPreview({ futurecast, movement, loading }: Props): React.ReactElement {
  const trending = [...(futurecast?.players ?? [])]
    .sort((a, b) => Math.abs(b.trendDelta7d ?? 0) - Math.abs(a.trendDelta7d ?? 0))
    .slice(0, 5);

  const risers = (movement?.topRisers ?? []).slice(0, 4);
  const fallers = (movement?.topFallers ?? []).slice(0, 4);

  return (
    <UfPremiumSection
      title="FutureCast"
      ctaLabel="Open FutureCast"
      ctaHref={VAULT_PILLAR_ROUTES.futurecast}
      testId="uf-premium-futurecast"
    >
      <div className="uf-premium-grid uf-premium-grid--2">
        <UfPremiumCard title="Trending Players">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : trending.length ? (
            <ul className="uf-premium-card__list">
              {trending.map((p) => (
                <li key={p.slug}>
                  <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}>
                    {p.name}
                  </a>
                  {' · UF '}
                  {ufPct(p.ufConfidence)}
                  {(p.trendDelta7d ?? 0) !== 0 && (
                    <>
                      {' · '}
                      <span className={(p.trendDelta7d ?? 0) > 0 ? 'uf-premium-delta--up' : 'uf-premium-delta--down'}>
                        {(p.trendDelta7d ?? 0) > 0 ? '+' : ''}
                        {Math.round(p.trendDelta7d ?? 0)}%
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="uf-premium-empty">FutureCast probabilities updating.</p>
          )}
        </UfPremiumCard>

        <UfPremiumCard title="Probability Shifts">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : risers.length || fallers.length ? (
            <ul className="uf-premium-card__list">
              {risers.map((p) => (
                <li key={`up-${p.id}`}>
                  <span className="uf-premium-delta--up">↑ {p.name}</span>
                  {' · +'}
                  {Math.abs(p.delta ?? 0).toFixed(1)}%
                </li>
              ))}
              {fallers.map((p) => (
                <li key={`dn-${p.id}`}>
                  <span className="uf-premium-delta--down">↓ {p.name}</span>
                  {' · '}
                  {(p.delta ?? 0).toFixed(1)}%
                </li>
              ))}
            </ul>
          ) : (
            <p className="uf-premium-empty">No major probability shifts this window.</p>
          )}
        </UfPremiumCard>
      </div>
    </UfPremiumSection>
  );
}

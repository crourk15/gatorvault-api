'use client';

import React from 'react';
import { SITE_ROUTES } from '@/lib/site-routes';
import type { HomeNilPulse } from '@/lib/vault-home-api';
import { UfPremiumCard, UfPremiumSection } from './primitives';

type Props = {
  nil: HomeNilPulse | null;
  valuation: string;
  grade: string;
  loading?: boolean;
};

export function NILTrackerPreview({ nil, valuation, grade, loading }: Props): React.ReactElement {
  const movers = nil?.topEarnerNote ? [nil.topEarner, nil.topEarnerNote] : [];

  return (
    <UfPremiumSection
      title="NIL Tracker"
      ctaLabel="Open NIL Command Center"
      ctaHref={SITE_ROUTES.nil}
      testId="uf-premium-nil"
    >
      <div className="uf-premium-grid uf-premium-grid--3">
        <UfPremiumCard title="NIL Valuation">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : (
            <p className="uf-premium-metric__value">{valuation}</p>
          )}
        </UfPremiumCard>

        <UfPremiumCard title="Competitiveness Grade">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : (
            <p className="uf-premium-metric__value">{grade}</p>
          )}
        </UfPremiumCard>

        <UfPremiumCard title="Top NIL Movers">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : nil ? (
            <ul className="uf-premium-card__list">
              <li>
                {nil.topEarner}
                <br />
                <span className="uf-premium-empty">{nil.topEarnerNote}</span>
              </li>
              {nil.movementDelta !== '—' && (
                <li>
                  {nil.movementLabel} · {nil.movementDelta}
                </li>
              )}
              {movers.length === 0 && <li>SEC rank #{nil.secRank || '—'}</li>}
            </ul>
          ) : (
            <p className="uf-premium-empty">NIL data updating.</p>
          )}
        </UfPremiumCard>
      </div>
    </UfPremiumSection>
  );
}

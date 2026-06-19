'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import type { HomeGameCard } from '@/lib/vault-home-api';
import { UfPremiumCard, UfPremiumSection } from './primitives';

type Props = {
  game: HomeGameCard | null;
  loading?: boolean;
};

export function SchedulePreview({ game, loading }: Props): React.ReactElement {
  return (
    <UfPremiumSection
      title="Schedule & Tickets"
      ctaLabel="View Full Schedule"
      ctaHref={VAULT_PILLAR_ROUTES.schedule}
      testId="uf-premium-schedule"
    >
      <UfPremiumCard title="Next Game">
        {loading ? (
          <div className="uf-premium-skeleton" />
        ) : game ? (
          <>
            <p className="uf-premium-schedule__opp">vs {game.opponent}</p>
            <p className="uf-premium-schedule__meta">
              {game.dateLabel}
              {game.timeLabel ? ` · ${game.timeLabel}` : ''}
              {game.venue ? ` · ${game.venue}` : ''}
            </p>
            {game.probability ? (
              <p className="uf-premium-schedule__meta">UF win prob {game.probability}%</p>
            ) : null}
          </>
        ) : (
          <p className="uf-premium-empty">Schedule loading.</p>
        )}
      </UfPremiumCard>
    </UfPremiumSection>
  );
}

'use client';

import React from 'react';
import type { HomeUpcomingGamesData } from '@/lib/vault-home-api';

type Props = {
  data: HomeUpcomingGamesData | null;
  loading?: boolean;
};

export function HomeSchedulePreview({ data, loading }: Props): React.ReactElement {
  const next = data?.games?.[0];

  if (loading && !data) {
    return <div className="uf-premium-skeleton" style={{ minHeight: 140 }} />;
  }

  if (!next) {
    return (
      <p className="uf-premium-empty" data-testid="home-schedule-preview">
        2026 schedule loading — check back for kickoff times and ticket links.
      </p>
    );
  }

  return (
    <article className="uf-premium-card uf-premium-card--schedule" data-testid="home-schedule-preview">
      <h3 className="uf-premium-card__title">Next Game</h3>
      <p className="uf-premium-schedule__opp">vs {next.opponent}</p>
      <p className="uf-premium-schedule__meta">
        {next.dateLabel} · {next.timeLabel}
      </p>
      <p className="uf-premium-schedule__meta">{next.venue}</p>
      <a href="/vault/schedule" className="uf-premium-cta uf-premium-cta--primary uf-premium-cta--block">
        View Full Schedule
      </a>
    </article>
  );
}

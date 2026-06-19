'use client';

import React from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { heatmapSparkPct } from '@/lib/vault-home-api';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { playerProfilePath } from '@/lib/player-routes';
import { HomeModuleCard } from '@/components/home/HomeModuleCard';
import './HomeFutureCastSnapshot.css';

type Props = {
  data: StaffDashboardResponse | null;
  loading?: boolean;
};

function fitBadge(delta: number | null | undefined): { label: string; tone: 'elite' | 'strong' | 'watch' } {
  const d = delta ?? 0;
  if (d >= 8) return { label: 'Elite fit', tone: 'elite' };
  if (d >= 3) return { label: 'Strong fit', tone: 'strong' };
  return { label: 'Watch', tone: 'watch' };
}

export function HomeFutureCastSnapshot({ data, loading }: Props): React.ReactElement {
  if (loading || !data) {
    return (
      <HomeModuleCard
        gridClass="gv-home__cell--6"
        eyebrow="FutureCast"
        title="FutureCast Preview"
        subtitle="Trending players and probability shifts"
        ariaLabel="FutureCast snapshot"
        testId="home-futurecast"
        loading
        skeletonHeight={220}
      />
    );
  }

  const leaders = [...(data.topRisers ?? [])]
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 3);
  const sparkPct = heatmapSparkPct(data.heatmap.buckets);

  return (
    <HomeModuleCard
      gridClass="gv-home__cell--6"
      eyebrow="FutureCast"
      title="FutureCast Preview"
      subtitle={`Trending players · ${data.movementWindowDays || 7}-day movement window`}
      stats={[
        { value: String(leaders.length), label: 'Top risers', tone: 'up' },
        { value: `${sparkPct}%`, label: 'Volatility', tone: 'accent' },
      ]}
      link={{ href: `${VAULT_PILLAR_ROUTES.futurecast}/movement`, label: 'Open FutureCast →' }}
      ariaLabel="FutureCast snapshot"
      testId="home-futurecast"
    >
      <ul className="gv-home-fc-leaders">
        {leaders.map((p, idx) => {
          const badge = fitBadge(p.delta);
          const pct = Math.min(99, Math.max(35, 55 + (p.delta ?? 0) * 2));
          return (
            <li key={p.id} className="gv-home-fc-leaders__row">
              <span className="gv-home-fc-leaders__rank">#{idx + 1}</span>
              <div className="gv-home-fc-leaders__body">
                <a
                  href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
                  className="gv-home-fc-leaders__name"
                >
                  {p.name}
                </a>
                <div className="gv-home-fc-leaders__meta">
                  <span className="gv-home-fc-leaders__pct">{pct}% UF</span>
                  <span
                    className={`gv-home-fc-leaders__delta gv-home-fc-leaders__delta--${(p.delta ?? 0) >= 0 ? 'up' : 'down'}`}
                  >
                    {(p.delta ?? 0) >= 0 ? '↑' : '↓'} {Math.abs(p.delta ?? 0)}
                  </span>
                  <span className={`gv-home-fc-leaders__badge gv-home-fc-leaders__badge--${badge.tone}`}>
                    {badge.label}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
        {leaders.length === 0 && (
          <li className="gv-home-gnl-preview__empty">FutureCast probabilities updating.</li>
        )}
      </ul>
    </HomeModuleCard>
  );
}

'use client';

import React from 'react';
import type { PersonalizedResponse, RecruitingSnapshot } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  snapshot: RecruitingSnapshot | null;
  movement: StaffDashboardResponse | null;
  personalized: PersonalizedResponse | null;
  loading?: boolean;
};

export function HomeRecruitingPreview({
  snapshot,
  movement,
  personalized,
  loading,
}: Props): React.ReactElement {
  if (loading && !snapshot) {
    return (
      <div className="uf-premium-grid uf-premium-grid--3">
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
        <div className="uf-premium-skeleton" />
      </div>
    );
  }

  const risers = movement?.topRisers?.slice(0, 4) ?? [];
  const topTargetNames = risers.map((p) => p.name).filter(Boolean);

  const commits = snapshot?.commits ?? 0;
  const classRank = snapshot?.classRank != null ? `#${snapshot.classRank}` : '—';
  const buckets = movement?.heatmap?.buckets ?? [];
  const heatBuckets = buckets.length > 0 ? buckets.slice(0, 3) : [];

  return (
    <div className="uf-premium-grid uf-premium-grid--3" data-testid="home-recruiting-preview">
      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Top Targets</h3>
        <ul className="uf-premium-card__list">
          {topTargetNames.length ? (
            topTargetNames.map((name) => {
              const player = risers.find((p) => p.name === name);
              return (
                <li key={name}>
                  {player?.slug ? (
                    <a href={playerProfilePath(player.slug, 'HIGH_SCHOOL', true, player.name, 'futurecast')}>
                      {name}
                    </a>
                  ) : (
                    name
                  )}
                </li>
              );
            })
          ) : (
            <li className="uf-premium-empty">No movement risers loaded.</li>
          )}
        </ul>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Commits</h3>
        <div className="uf-premium-metric">
          <span className="uf-premium-metric__value">{commits}</span>
          <span className="uf-premium-metric__label">Total commits</span>
        </div>
        <p className="uf-premium-card__body">
          Class rank {classRank} · {snapshot?.targets ?? 0} active targets on the board.
        </p>
      </article>

      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Movement Heatmap</h3>
        <div className="uf-premium-heatmap" aria-label="Movement heatmap">
          {heatBuckets.length ? (
            heatBuckets.map((bucket) => (
              <div key={bucket.label} className="uf-premium-heatmap__pill">
                <strong>{bucket.count ?? 0}</strong>
                <span>{bucket.label}</span>
              </div>
            ))
          ) : (
            <p className="uf-premium-empty">Movement data updating.</p>
          )}
        </div>
      </article>
    </div>
  );
}

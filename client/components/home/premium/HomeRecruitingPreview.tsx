'use client';

import React from 'react';
import type { PersonalizedResponse, RecruitingSnapshot } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { heatmapSparkPct } from '@/lib/vault-home-api';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
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
  const watchlist = (personalized?.watchlist ?? [])
    .slice(0, 4)
    .map((w) => w.label)
    .filter(Boolean);
  const topTargetNames =
    risers.length > 0
      ? risers.map((p) => p.name)
      : watchlist.length > 0
        ? watchlist
        : ['2027 WR board', 'Portal edge targets', 'In-state priorities'];

  const commits = snapshot?.commits ?? 0;
  const classRank = snapshot?.classRank != null ? `#${snapshot.classRank}` : '—';
  const buckets = movement?.heatmap?.buckets ?? [];
  const heatLabels = ['Cool', 'Warm', 'Hot'];
  const heatValues =
    buckets.length >= 3
      ? buckets.slice(0, 3).map((b) => b.count ?? 0)
      : [Math.max(1, Math.floor(commits / 3)), Math.max(1, snapshot?.targets ?? 0), heatmapSparkPct(buckets)];

  return (
    <div className="uf-premium-grid uf-premium-grid--3" data-testid="home-recruiting-preview">
      <article className="uf-premium-card">
        <h3 className="uf-premium-card__title">Top Targets</h3>
        <ul className="uf-premium-card__list">
          {topTargetNames.map((name) => {
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
          })}
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
          {heatLabels.map((label, idx) => (
            <div key={label} className="uf-premium-heatmap__pill">
              <strong>{heatValues[idx] ?? 0}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

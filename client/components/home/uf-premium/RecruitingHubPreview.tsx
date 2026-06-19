'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { playerProfilePath } from '@/lib/player-routes';
import type { RecruitingBoardResponse } from '@/lib/recruiting-board-api';
import type { RecruitingSnapshot } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { UfPremiumCard, UfPremiumSection } from './primitives';

type Props = {
  recruiting: RecruitingSnapshot | null;
  board: RecruitingBoardResponse | null;
  movement: StaffDashboardResponse | null;
  loading?: boolean;
};

export function RecruitingHubPreview({ recruiting, board, movement, loading }: Props): React.ReactElement {
  const topTargets = (board?.targets ?? []).slice(0, 4);
  const commits = (board?.commits ?? []).slice(0, 4);
  const buckets = movement?.heatmap?.buckets ?? [];

  return (
    <UfPremiumSection
      title="Recruiting Hub"
      ctaLabel="Explore Recruiting Hub"
      ctaHref={VAULT_PILLAR_ROUTES.recruiting}
      testId="uf-premium-recruiting"
    >
      <div className="uf-premium-grid uf-premium-grid--3">
        <UfPremiumCard title="Top Targets">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : topTargets.length ? (
            <ul className="uf-premium-card__list">
              {topTargets.map((p) => (
                <li key={p.slug}>
                  <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'recruiting')}>
                    {p.name}
                  </a>
                  {' · '}
                  {p.position ?? p.pos ?? '—'}
                  {p.stars ? ` · ${p.stars}★` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="uf-premium-empty">No targets loaded.</p>
          )}
        </UfPremiumCard>

        <UfPremiumCard title="Commits">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : commits.length ? (
            <ul className="uf-premium-card__list">
              {commits.map((p) => (
                <li key={p.slug}>
                  <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'recruiting')}>
                    {p.name}
                  </a>
                  {' · '}
                  {p.position ?? p.pos ?? '—'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="uf-premium-empty">
              {recruiting?.commits ? `${recruiting.commits} commits on board` : 'No commits loaded.'}
            </p>
          )}
        </UfPremiumCard>

        <UfPremiumCard title="Movement Heatmap">
          {loading ? (
            <div className="uf-premium-skeleton" />
          ) : buckets.length ? (
            <div className="uf-premium-heatmap">
              {buckets.map((b) => (
                <div key={b.label} className="uf-premium-heatmap__pill">
                  <strong>{b.count}</strong>
                  <span>{b.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="uf-premium-empty">Movement data updating.</p>
          )}
        </UfPremiumCard>
      </div>
    </UfPremiumSection>
  );
}

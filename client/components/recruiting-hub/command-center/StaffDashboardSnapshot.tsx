'use client';

import React, { useMemo } from 'react';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { playerProfilePath } from '@/lib/player-routes';
import { ModuleShell, MovementBadge, UfProbBar } from './primitives';

type Props = {
  staffDashboard: StaffDashboardResponse | null;
};

export function StaffDashboardSnapshot({ staffDashboard }: Props): React.ReactElement {
  const topVolatile = staffDashboard?.highVolatility?.[0] ?? null;
  const buckets = staffDashboard?.heatmap?.buckets ?? [];

  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.count)),
    [buckets]
  );

  return (
    <ModuleShell title="Staff Dashboard — Volatility & Focus" testId="rh-cc-staff-snapshot">
      <div className="rh-cc-staff">
        <div className="rh-cc-staff__heatmap">
          <p className="rh-cc-staff__heatmap-label">Volatility heatmap (window)</p>
          <div className="rh-cc-heatmap">
            {buckets.length === 0 ? (
              <p className="rh-cc-empty">Heatmap data loading…</p>
            ) : (
              buckets.map((bucket) => {
                const intensity = bucket.count / maxCount;
                return (
                  <div
                    key={bucket.label}
                    className="rh-cc-heatmap__cell"
                    style={{ opacity: 0.35 + intensity * 0.65 }}
                    title={`${bucket.label}: ${bucket.count} targets`}
                  >
                    <span className="rh-cc-heatmap__count">{bucket.count}</span>
                    <span className="rh-cc-heatmap__label">{bucket.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="rh-cc-staff__focus">
          <p className="rh-cc-staff__focus-label">Top Volatile Target</p>
          {topVolatile ? (
            <div className="rh-cc-focus-card">
              <a
                href={playerProfilePath(
                  topVolatile.slug,
                  'HIGH_SCHOOL',
                  true,
                  topVolatile.name,
                  'futurecast'
                )}
                className="rh-cc-focus-card__name"
              >
                {topVolatile.name}
              </a>
              <p className="rh-cc-focus-card__meta">Priority target · UF board</p>
              <div className="rh-cc-focus-card__meter">
                <span>Volatility</span>
                <div className="rh-cc-vol-bar">
                  <div
                    className="rh-cc-vol-bar__fill"
                    style={{
                      width: `${Math.min(100, (topVolatile.volatilityScore ?? 20) * 5)}%`,
                    }}
                  />
                </div>
                <span>{topVolatile.volatilityScore ?? 20}</span>
              </div>
              <UfProbBar value={62} />
              <MovementBadge delta={topVolatile.delta7d ?? topVolatile.delta ?? 0} tone="volatile" />
            </div>
          ) : (
            <p className="rh-cc-empty">No volatile targets flagged.</p>
          )}
        </div>
      </div>
    </ModuleShell>
  );
}

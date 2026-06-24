'use client';

import React, { useCallback } from 'react';
import type { RhHubHeatTarget } from '@/lib/recruiting-hub-elite-api';
import { fetchHeatIndex } from '@/lib/recruiting-ui-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';

function heatBandClass(heat: number): string {
  if (heat >= 70) return 'rh-heat-fill--hot';
  if (heat >= 45) return 'rh-heat-fill--warm';
  return 'rh-heat-fill--cool';
}

function movementSymbol(movement: RhHubHeatTarget['movement']): string {
  if (movement === 'up') return '▲';
  if (movement === 'down') return '▼';
  return '—';
}

function HeatTargetCard({ target }: { target: RhHubHeatTarget }): React.ReactElement {
  return (
    <article className="rh-card rh-heat-card" data-testid={`rh-heat-${target.id}`}>
      <div className="rh-flex-between">
        <div>
          <a href={target.profileUrl} className="rh-player-name">
            {target.name}
          </a>
          <div className="rh-player-pos">{target.position}</div>
        </div>
        <span className={`rh-movement rh-movement--${target.movement}`} aria-label={`Movement ${target.movement}`}>
          {movementSymbol(target.movement)}
        </span>
      </div>
      <div className="rh-heat-bar" aria-label={`Heat score ${target.heat}`}>
        <div
          className={`rh-heat-fill ${heatBandClass(target.heat)}`}
          style={{ width: `${target.heat}%` }}
        />
      </div>
      <div className="rh-heat-meta">
        <span>UF %: {target.ufPercent != null ? target.ufPercent : '—'}</span>
        <span>
          Battle:{' '}
          {target.battle.uf != null || target.battle.competitor != null || target.battle.competitorName
            ? `UF ${target.battle.uf ?? '—'} / ${target.battle.competitor ?? '—'} ${target.battle.competitorName ?? ''}`.trim()
            : '—'}
        </span>
      </div>
      {target.nextVisit ? <div className="rh-heat-visit">Next visit: {target.nextVisit}</div> : null}
      {target.insiderNote ? <div className="rh-heat-note">{target.insiderNote}</div> : null}
      <a href={target.profileUrl} className="rh-heat-profile-link">
        Full profile →
      </a>
    </article>
  );
}

export function TopTargetsHeatIndex(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const selectHeat = useCallback((b: { heatIndex: RhHubHeatTarget[] }) => b.heatIndex, []);
  const fetchHeat = useCallback(
    async (year: number) => {
      const res = await fetchHeatIndex(year);
      return res.items ?? [];
    },
    []
  );
  const { data, loading, error } = useHubBundleSection({
    select: selectHeat,
    fetchFallback: fetchHeat,
  });

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Top Targets Heat Index</div>
        <div className="rh-section-subtitle">
          {activeYear} class — real-time momentum on Florida&apos;s priority targets.
        </div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-heat-index" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-heat-index">
          <p className="rh-empty">{error ? 'Could not load heat index.' : 'Heat index updating — check back shortly.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-heat-index">
          <p className="rh-empty">Heat index updating — check back shortly.</p>
        </section>
      ) : (
        <section className="rh-grid-2col" data-testid="rh-elite-heat-index">
          {data.map((target) => (
            <HeatTargetCard key={target.id} target={target} />
          ))}
        </section>
      )}
    </>
  );
}

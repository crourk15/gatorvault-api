'use client';

import React, { useEffect, useState } from 'react';
import type { RhHubHeatTarget } from '@/lib/recruiting-hub-elite-api';
import { fetchHeatIndex } from '@/lib/recruiting-ui-api';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

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
  const [data, setData] = useState<RhHubHeatTarget[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHeatIndex(ACTIVE_RECRUITING_CLASS_YEAR)
      .then((res) => {
        if (!cancelled) setData(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Top Targets Heat Index</div>
        <div className="rh-section-subtitle">Real-time momentum on Florida&apos;s priority targets.</div>
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

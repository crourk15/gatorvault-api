'use client';

import React, { useCallback } from 'react';
import type { RhHubHeatTarget } from '@/lib/recruiting-hub-elite-api';
import { fetchRecruitingHubHeatIndex } from '@/lib/recruiting-hub-elite-api';
import { useRecruitingClassYear } from '@/lib/recruiting-class-year-store';
import { useHubBundleSection } from '@/components/recruiting-hub/elite/useHubBundleSection';
import { UiWarming } from '@/components/site/UiMessage';

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

/** Board scores (not percents): "UF 10 · Auburn 16". */
function formatBattleLine(battle: RhHubHeatTarget['battle']): string {
  const uf = battle?.uf;
  const comp = battle?.competitor;
  const name = String(battle?.competitorName || '').trim();
  if (uf == null && comp == null && !name) return '—';
  const ufPart = `UF ${uf ?? '—'}`;
  if (!name && comp == null) return ufPart;
  const rivalPart = name ? `${name} ${comp ?? '—'}`.trim() : `${comp ?? '—'}`;
  return `${ufPart} · ${rivalPart}`;
}

function HeatTargetCard({
  target,
  showFutureCastLink,
}: {
  target: RhHubHeatTarget;
  showFutureCastLink: boolean;
}): React.ReactElement {
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
        <span>Battle: {formatBattleLine(target.battle)}</span>
      </div>
      {target.nextVisit ? <div className="rh-heat-visit">Next visit: {target.nextVisit}</div> : null}
      {target.insiderNote ? <div className="rh-heat-note">{target.insiderNote}</div> : null}
      <div className="rh-heat-links">
        <a href={target.profileUrl} className="rh-heat-profile-link">
          Recruiting profile →
        </a>
        {showFutureCastLink ? (
          <a href={`/vault/futurecast/player/${encodeURIComponent(target.id)}`} className="rh-heat-fc-link">
            FutureCast intel →
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function TopTargetsHeatIndex(): React.ReactElement {
  const { activeYear } = useRecruitingClassYear();
  const selectHeat = useCallback((b: { heatIndex: RhHubHeatTarget[] }) => b.heatIndex, []);
  const fetchHeat = useCallback(
    (year: number) => fetchRecruitingHubHeatIndex(year),
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
        <div className="rh-hub-warming" role="status" aria-live="polite" aria-busy="true">
          <UiWarming hint="Loading heat index…" />
        </div>
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
            <HeatTargetCard key={target.id} target={target} showFutureCastLink={activeYear >= 2027} />
          ))}
        </section>
      )}
    </>
  );
}

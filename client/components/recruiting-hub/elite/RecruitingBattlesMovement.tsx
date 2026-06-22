'use client';

import React from 'react';
import { useRecruitingHubBundleContext } from '@/components/recruiting-hub/elite/RecruitingHubBundleContext';

export function RecruitingBattlesMovement(): React.ReactElement {
  const { data: bundle, loading, error } = useRecruitingHubBundleContext();
  const data = bundle?.battles;

  return (
    <>
      <div className="rh-section-header">
        <div className="rh-section-title">Battles &amp; Movement</div>
        <div className="rh-section-subtitle">Key recruit battles and trend lines.</div>
      </div>
      {loading ? (
        <div className="rh-skeleton" data-testid="rh-elite-battles" aria-hidden="true" />
      ) : !data ? (
        <section className="rh-card" data-testid="rh-elite-battles">
          <p className="rh-empty">{error ? 'Could not load battle intel.' : 'Battle intel updating — check back shortly.'}</p>
        </section>
      ) : !data.length ? (
        <section className="rh-card" data-testid="rh-elite-battles">
          <p className="rh-empty">Battle intel updating — check back shortly.</p>
        </section>
      ) : (
        <section className="rh-battle-grid" data-testid="rh-elite-battles">
          {data.map((b) => (
            <article key={b.id} className="rh-battle-card">
              <div className="rh-battle-header">
                <div className="rh-battle-name">
                  {b.name} · {b.position}
                </div>
                <span className="rh-badge">{b.tag}</span>
              </div>
              <div className="rh-battle-body">{b.note}</div>
              <div className="rh-battle-footer">
                <span>UF % {b.ufPercent}</span>
                <span>{b.movement}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </>
  );
}

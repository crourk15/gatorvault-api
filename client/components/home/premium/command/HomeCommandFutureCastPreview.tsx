'use client';

import React from 'react';
import type { HomeFutureCastTargetView } from '@/components/home/premium/command/home-command-utils';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  targets: HomeFutureCastTargetView[];
  loading?: boolean;
};

export function HomeCommandFutureCastPreview({ targets, loading }: Props): React.ReactElement {
  return (
    <>
      <div className="home-section-header">
        <h2 className="home-section-title">FutureCast Preview</h2>
        <p className="home-section-subtitle">Top UF leaners from the FutureCast model.</p>
      </div>
      <section className="home-card" data-testid="home-futurecast-preview">
        {loading ? (
          <div className="home-card-skeleton" aria-hidden="true" />
        ) : targets.length === 0 ? (
          <p className="home-empty">FutureCast targets updating — check back shortly.</p>
        ) : (
          <>
            <p className="home-strip-title" style={{ marginBottom: 8 }}>
              Top FutureCast Targets
            </p>
            <div className="home-fc-list">
              {targets.map((t) => (
                <div key={t.id} className="home-fc-row">
                  <span className="home-fc-name">
                    {t.name} · {t.position}
                  </span>
                  <span className="home-fc-percent">{t.ufPercent}</span>
                </div>
              ))}
            </div>
            <a href={VAULT_PILLAR_ROUTES.futurecast} className="home-strip-link" style={{ marginTop: 10, display: 'inline-block' }}>
              Open FutureCast Lab →
            </a>
          </>
        )}
      </section>
    </>
  );
}

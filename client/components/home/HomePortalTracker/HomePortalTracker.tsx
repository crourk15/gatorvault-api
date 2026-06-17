'use client';

import React from 'react';
import type { HomePortalSummary } from '@/lib/vault-home-api';

type Props = {
  data: HomePortalSummary | null;
  loading?: boolean;
};

export function HomePortalTracker({ data, loading }: Props): React.ReactElement {
  const inboundCount = data?.inboundCount ?? 0;
  const outboundCount = data?.outboundCount ?? 0;
  const targetCount = data?.targetCount ?? 0;
  const topPlayers = data?.topPlayers ?? [];

  if (loading && !data) {
    return (
      <article className="gv-home__cell gv-home__cell--6" aria-label="Portal tracker" data-testid="home-portal">
        <div className="gv-home-skeleton gv-home-skeleton--card" />
      </article>
    );
  }

  return (
    <article className="gv-home__cell gv-home__cell--6" aria-label="Portal tracker" data-testid="home-portal">
      <div className="gv-home-card">
        <div className="gv-home-card__accent" />
        <h2 className="gv-home-card__title">Portal Movement</h2>
        <div className="gv-home-card__stats gv-home-card__stats--three">
          <div className="stat">
            <span>Inbound</span>
            <strong>{inboundCount}</strong>
          </div>
          <div className="stat">
            <span>Outbound</span>
            <strong>{outboundCount}</strong>
          </div>
          <div className="stat">
            <span>Targets</span>
            <strong>{targetCount}</strong>
          </div>
        </div>
        <ul className="gv-home-list gv-home-list--portal">
          {topPlayers.map((p) => (
            <li key={p.id}>
              <span className="gv-home-list__primary">
                {p.name} <span className="gv-home-list__meta">{p.position}</span>
              </span>
              <span className={`gv-home-badge gv-home-badge--${p.status.toLowerCase()}`}>{p.status}</span>
            </li>
          ))}
          {topPlayers.length === 0 && (
            <li>
              <span className="gv-home-list__meta">Portal intel updating — check back shortly.</span>
            </li>
          )}
        </ul>
        <a href="/portal" className="gv-home-link">
          Open Portal Tracker →
        </a>
      </div>
    </article>
  );
}

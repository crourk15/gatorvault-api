'use client';

import React from 'react';
import type { HomeTeamSnapshotData } from '@/lib/vault-home-api';
import { SITE_ROUTES } from '@/lib/site-routes';

type Props = {
  data: HomeTeamSnapshotData | null;
  loading?: boolean;
};

export function HomeTeamSnapshot({ data, loading }: Props): React.ReactElement {
  const depthPreview = data?.depthPreview ?? [];
  const battles = data?.battles ?? [];
  const injuries = data?.injuries ?? [];
  const snapSummary = data?.snapSummary ?? 'Depth chart and snap projections loading.';

  if (loading && !data) {
    return (
      <article className="gv-home__cell gv-home__cell--6" aria-label="Team snapshot" data-testid="home-team-snapshot">
        <div className="gv-home-skeleton gv-home-skeleton--card" style={{ minHeight: 260 }} />
      </article>
    );
  }

  return (
    <article className="gv-home__cell gv-home__cell--6" aria-label="Team snapshot" data-testid="home-team-snapshot">
      <div className="gv-home-card">
        <div className="gv-home-card__accent" />
        <h2 className="gv-home-card__title">Team Snapshot</h2>
        <div className="gv-home-grid gv-home-grid--two">
          <div>
            <h3 className="gv-home-subtitle">Depth Chart</h3>
            <ul className="gv-home-list">
              {depthPreview.map((d) => (
                <li key={d.position}>
                  <span className="gv-home-list__primary">
                    {d.position} — {d.player}
                  </span>
                  <span className={`gv-home-badge gv-home-badge--${d.status.toLowerCase()}`}>{d.status}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="gv-home-subtitle">Position Battles</h3>
            <ul className="gv-home-list">
              {battles.length > 0 ? (
                battles.map((b) => (
                  <li key={b.label}>
                    <span className="gv-home-list__primary">{b.label}</span>
                    <span className="gv-home-list__meta">{b.players}</span>
                  </li>
                ))
              ) : (
                <li>
                  <span className="gv-home-list__meta">No open battles flagged on the depth chart.</span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="gv-home-subtitle">Injuries</h3>
            <ul className="gv-home-list">
              {injuries.length > 0 ? (
                injuries.map((i) => (
                  <li key={i.name}>
                    <span className="gv-home-list__primary">{i.name}</span>
                    <span className={`gv-home-badge gv-home-badge--${i.status.toLowerCase()}`}>{i.status}</span>
                  </li>
                ))
              ) : (
                <li>
                  <span className="gv-home-list__meta">No active injury designations on the roster.</span>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="gv-home-subtitle">Snap Projections</h3>
            <p className="gv-home-body">{snapSummary}</p>
          </div>
        </div>
        <a href={SITE_ROUTES.team} className="gv-home-link">
          Open Team Hub →
        </a>
      </div>
    </article>
  );
}

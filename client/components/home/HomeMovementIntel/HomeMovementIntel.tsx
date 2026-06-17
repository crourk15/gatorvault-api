'use client';

import React from 'react';
import type { MovementIntelResponse } from '@/lib/movement-intel-types';
import { movementDelta7d } from '@/lib/movement-intel-types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  data: MovementIntelResponse | null;
  loading?: boolean;
};

function playerHref(item: { id: string; slug?: string; name: string }): string {
  return playerProfilePath(item.slug || item.id, 'HIGH_SCHOOL', true, item.name, 'futurecast');
}

export function HomeMovementIntel({ data, loading }: Props): React.ReactElement {
  if (loading && !data) {
    return (
      <article className="gv-home-card gv-home-movement-intel" aria-label="Movement intel">
        <div className="gv-home-skeleton" style={{ minHeight: 220 }} />
      </article>
    );
  }

  const risers = data?.risers ?? [];
  const fallers = data?.fallers ?? [];
  const volatile = data?.volatile ?? [];
  const alerts = data?.alerts ?? [];
  const lastUpdated = data?.lastUpdated ?? data?.updatedAt ?? null;

  return (
    <article className="gv-home-card gv-home-movement-intel" aria-label="Movement intel" data-testid="home-movement-intel">
      <div className="gv-home-card__accent" />
      <h2 className="gv-home-card__title">Movement Intel: Who&apos;s Rising?</h2>
      {lastUpdated ? (
        <p className="gv-home-meta">
          Last updated: {formatIntelUpdated(lastUpdated)}
        </p>
      ) : null}

      <h3 className="gv-home-subtitle">Risers (7-day window)</h3>
      <ul className="gv-home-list">
        {risers.slice(0, 3).map((p) => (
          <li key={p.id}>
            <a href={playerHref(p)} className="gv-home-list__primary gv-home-movement-intel__link">
              {p.name}{' '}
              <span className="gv-home-list__meta">
                {p.position} · {p.school}
              </span>
            </a>
            <span className="gv-home-badge gv-home-badge--rise">+{movementDelta7d(p)}%</span>
          </li>
        ))}
        {risers.length === 0 && (
          <li>
            <span className="gv-home-list__meta">No risers with +5% UF movement.</span>
          </li>
        )}
      </ul>

      <h3 className="gv-home-subtitle">Fallers (7-day window)</h3>
      <ul className="gv-home-list">
        {fallers.slice(0, 3).map((p) => (
          <li key={p.id}>
            <a href={playerHref(p)} className="gv-home-list__primary gv-home-movement-intel__link">
              {p.name}{' '}
              <span className="gv-home-list__meta">
                {p.position} · {p.school}
              </span>
            </a>
            <span className="gv-home-badge gv-home-badge--fall">{movementDelta7d(p)}%</span>
          </li>
        ))}
        {fallers.length === 0 && (
          <li>
            <span className="gv-home-list__meta">No fallers with -5% UF movement.</span>
          </li>
        )}
      </ul>

      <h3 className="gv-home-subtitle">Volatile</h3>
      <ul className="gv-home-list">
        {volatile.slice(0, 3).map((p) => (
          <li key={p.id}>
            <a href={playerHref(p)} className="gv-home-list__primary gv-home-movement-intel__link">
              {p.name}{' '}
              <span className="gv-home-list__meta">
                {p.position} · {p.school}
              </span>
            </a>
            <span className="gv-home-badge gv-home-badge--volatile">±{Math.abs(movementDelta7d(p))}%</span>
          </li>
        ))}
        {volatile.length === 0 && (
          <li>
            <span className="gv-home-list__meta">No volatile targets in window.</span>
          </li>
        )}
      </ul>

      <h3 className="gv-home-subtitle">Recent Alerts</h3>
      <ul className="gv-home-list">
        {alerts.slice(0, 4).map((a) => (
          <li key={a.id}>
            <span className="gv-home-list__primary">{a.player}</span>
            <span className="gv-home-list__meta">{a.detail}</span>
          </li>
        ))}
        {alerts.length === 0 && (
          <li>
            <span className="gv-home-list__meta">No recent intel events.</span>
          </li>
        )}
      </ul>

      <a href="/vault/recruiting/movement" className="gv-home-link">
        Full Movement Intel →
      </a>
    </article>
  );
}

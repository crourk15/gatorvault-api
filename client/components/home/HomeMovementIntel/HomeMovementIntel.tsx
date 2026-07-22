'use client';

import React from 'react';
import type { MovementIntelItem, MovementIntelResponse } from '@/lib/movement-intel-types';
import { movementDelta7d } from '@/lib/movement-intel-types';
import { formatIntelUpdated } from '@/components/recruiting-hub/utils/formatDate';
import { playerHref } from '@/lib/player-link';

type Props = {
  data: MovementIntelResponse | null;
  loading?: boolean;
};

function profileHref(item: { id: string; slug?: string; name: string }): string {
  return playerHref({ slug: item.slug, id: item.id, name: item.name }, 'futurecast', 'HIGH_SCHOOL');
}

function ufPct(item: MovementIntelItem): number {
  const raw = item.ufProb;
  return raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
}

function MovementSparkline({ end, delta }: { end: number; delta: number }): React.ReactElement {
  const start = Math.max(0, Math.min(100, end - delta));
  const pts = [start, start + delta * 0.25, start + delta * 0.5, start + delta * 0.75, end];
  const coords = pts.map((v, i) => `${(i / 4) * 40},${22 - (v / 100) * 18}`).join(' ');
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return (
    <svg className={`rh-movement-sparkline rh-movement-sparkline--${trend}`} viewBox="0 0 40 24" aria-hidden>
      <polyline points={coords} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function MovementBadge({
  delta,
  tone,
}: {
  delta: number;
  tone: 'rise' | 'fall' | 'volatile';
}): React.ReactElement {
  if (tone === 'volatile') {
    return (
      <span className="rh-movement-badge rh-movement-badge--volatile">
        <span className="rh-movement-badge__icon" aria-hidden>
          ⚡
        </span>
        ±{Math.abs(delta)}%
      </span>
    );
  }
  if (tone === 'rise') {
    return (
      <span className="rh-movement-badge rh-movement-badge--rise">
        <span className="rh-movement-badge__icon" aria-hidden>
          ↑
        </span>
        +{delta}%
      </span>
    );
  }
  return (
    <span className="rh-movement-badge rh-movement-badge--fall">
      <span className="rh-movement-badge__icon" aria-hidden>
        ↓
      </span>
      {delta}%
    </span>
  );
}

function MovementStockRow({
  item,
  tone,
}: {
  item: MovementIntelItem;
  tone: 'rise' | 'fall' | 'volatile';
}): React.ReactElement {
  const delta = movementDelta7d(item);
  const rowClass =
    tone === 'volatile'
      ? 'rh-movement-stock-row rh-movement-stock-row--volatile'
      : 'rh-movement-stock-row';

  return (
    <div className={rowClass}>
      <div className="rh-movement-stock-row__identity">
        <a href={profileHref(item)} className="rh-movement-stock-row__name gv-home-movement-intel__link">
          {item.name}
        </a>
        <span className="rh-movement-stock-row__meta">
          {item.position} · {item.school}
        </span>
      </div>
      <div className="rh-movement-stock-row__right">
        <MovementSparkline end={ufPct(item)} delta={delta} />
        <MovementBadge delta={delta} tone={tone} />
      </div>
    </div>
  );
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

      <section className="gv-home-movement-intel__section rh-movement-section">
        <h3 className="rh-movement-section__title rh-movement-section__title--rise">Risers (7-day window)</h3>
        <ul className="gv-home-list">
          {risers.slice(0, 3).map((p) => (
            <li key={p.id}>
              <MovementStockRow item={p} tone="rise" />
            </li>
          ))}
          {risers.length === 0 && (
            <li>
              <span className="gv-home-list__meta">No risers with +5% UF movement.</span>
            </li>
          )}
        </ul>
      </section>

      <section className="gv-home-movement-intel__section rh-movement-section">
        <h3 className="rh-movement-section__title rh-movement-section__title--fall">Fallers (7-day window)</h3>
        <ul className="gv-home-list">
          {fallers.slice(0, 3).map((p) => (
            <li key={p.id}>
              <MovementStockRow item={p} tone="fall" />
            </li>
          ))}
          {fallers.length === 0 && (
            <li>
              <span className="gv-home-list__meta">No fallers with -5% UF movement.</span>
            </li>
          )}
        </ul>
      </section>

      <section className="gv-home-movement-intel__section rh-movement-section">
        <h3 className="rh-movement-section__title rh-movement-section__title--volatile">Volatile</h3>
        <ul className="gv-home-list">
          {volatile.slice(0, 3).map((p) => (
            <li key={p.id}>
              <MovementStockRow item={p} tone="volatile" />
            </li>
          ))}
          {volatile.length === 0 && (
            <li>
              <span className="gv-home-list__meta">No volatile targets in window.</span>
            </li>
          )}
        </ul>
      </section>

      <section className="gv-home-movement-intel__section rh-movement-section">
        <h3 className="rh-movement-section__title">Recent Alerts</h3>
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
      </section>

      <a href="/vault/recruiting/?tab=movement" className="gv-home-link">
        Full Movement Intel →
      </a>
    </article>
  );
}

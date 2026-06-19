'use client';

import React from 'react';
import type { FutureCastPlayer } from '@/lib/futurecast-board-types';
import { FC_METRIC_LABELS, formatFitPercent } from '@/lib/futurecast-elite-metrics';
import { playerProfilePath } from '@/lib/player-routes';

type Props = {
  title: string;
  players: FutureCastPlayer[];
  valueLabel: (p: FutureCastPlayer) => string;
  tone?: 'up' | 'down' | 'volatile' | 'stable' | 'fit' | 'risk';
};

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

function badgeClass(tone: Props['tone']): string {
  if (tone === 'up') return 'rh-movement-badge rh-movement-badge--rise';
  if (tone === 'down') return 'rh-movement-badge rh-movement-badge--fall';
  if (tone === 'volatile') return 'rh-movement-badge rh-movement-badge--volatile';
  return 'rh-movement-badge rh-movement-badge--flat';
}

function badgeIcon(tone: Props['tone']): string {
  if (tone === 'up') return '↑';
  if (tone === 'down') return '↓';
  if (tone === 'volatile') return '⚡';
  return '→';
}

export function MovementList({ title, players, valueLabel, tone = 'up' }: Props): React.ReactElement {
  const titleTone =
    tone === 'up' ? 'rise' : tone === 'down' ? 'fall' : tone === 'volatile' ? 'volatile' : '';

  return (
    <section className={`gv-movement-list gv-movement-list--${tone} rh-movement-section`}>
      <h3 className={`rh-movement-section__title${titleTone ? ` rh-movement-section__title--${titleTone}` : ''}`}>
        {title}
      </h3>
      <ul className="gv-movement-list__items">
        {players.slice(0, 8).map((p) => {
          const delta = p.trendDelta7d ?? 0;
          const uf = p.ufConfidence ?? 0;
          const ufEnd = uf <= 1 ? Math.round(uf * 100) : Math.round(uf);
          const rowClass =
            tone === 'volatile'
              ? 'rh-movement-stock-row rh-movement-stock-row--volatile'
              : 'rh-movement-stock-row';

          return (
            <li key={p.id}>
              <a
                href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
                className={rowClass}
              >
                <div className="rh-movement-stock-row__identity">
                  <span className="rh-movement-stock-row__name">{p.name}</span>
                  <span className="rh-movement-stock-row__meta">
                    {p.position}
                    {p.school ? ` · ${p.school}` : ''}
                  </span>
                </div>
                <div className="rh-movement-stock-row__right">
                  {(tone === 'up' || tone === 'down') && <MovementSparkline end={ufEnd} delta={delta} />}
                  <span className={badgeClass(tone)}>
                    <span className="rh-movement-badge__icon" aria-hidden>
                      {badgeIcon(tone)}
                    </span>
                    {valueLabel(p)}
                  </span>
                </div>
              </a>
            </li>
          );
        })}
        {players.length === 0 ? <li className="gv-empty">None in window.</li> : null}
      </ul>
    </section>
  );
}

export function VolatilityList({
  title,
  players,
}: {
  title: string;
  players: FutureCastPlayer[];
}): React.ReactElement {
  return (
    <MovementList
      title={title}
      players={players}
      tone="volatile"
      valueLabel={(p) => `σ ${p.volatility7d.toFixed(2)}`}
    />
  );
}

export function FitScoreList({
  title,
  players,
  leaders,
}: {
  title: string;
  players: FutureCastPlayer[];
  leaders?: boolean;
}): React.ReactElement {
  return (
    <MovementList
      title={title}
      players={players}
      tone={leaders ? 'fit' : 'risk'}
      valueLabel={(p) => `${FC_METRIC_LABELS.fit} ${formatFitPercent(p.fitScore)}`}
    />
  );
}

export function AlertsList({
  alerts,
}: {
  alerts: { id: string; message: string; createdAt: string }[];
}): React.ReactElement {
  return (
    <section className="gv-card gv-alerts-list rh-movement-section">
      <h3 className="rh-movement-section__title">Recent Alerts</h3>
      <ul className="gv-alerts-list__items">
        {alerts.slice(0, 6).map((a) => (
          <li key={a.id}>
            <span>{a.message}</span>
            <time className="gv-alerts-list__time" dateTime={a.createdAt}>
              {new Date(a.createdAt).toLocaleDateString()}
            </time>
          </li>
        ))}
        {alerts.length === 0 ? <li className="gv-empty">No recent alerts.</li> : null}
      </ul>
    </section>
  );
}

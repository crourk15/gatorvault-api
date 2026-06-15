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

export function MovementList({ title, players, valueLabel, tone = 'up' }: Props): React.ReactElement {
  return (
    <section className={`gv-movement-list gv-movement-list--${tone}`}>
      <h3 className="gv-card-title">{title}</h3>
      <ul className="gv-movement-list__items">
        {players.slice(0, 8).map((p) => (
          <li key={p.id}>
            <a
              href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}
              className="gv-movement-mini-card"
            >
              <span>{p.name}</span>
              <span className="gv-movement-list__value">
                {tone === 'volatile' ? (
                  <span className="gv-volatility-badge">{valueLabel(p)}</span>
                ) : (
                  valueLabel(p)
                )}
              </span>
            </a>
          </li>
        ))}
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
    <section className="gv-card gv-alerts-list">
      <h3 className="gv-card-title">Recent Alerts</h3>
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

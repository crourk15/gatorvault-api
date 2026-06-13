'use client';

/**
 * Staff dashboard — internal FutureCast control room.
 */
import React, { useEffect, useState } from 'react';
import { MovementHeatmap } from '@/components/futurecast/MovementHeatmap';
import {
  fetchStaffDashboard,
  type StaffDashboardPlayer,
  type StaffDashboardResponse,
} from '@/lib/staff-api';
import '@/lib/futurecast.css';

const REFRESH_MS = 60_000;

function PlayerLinks({
  title,
  tone,
  players,
  valueLabel,
}: {
  title: string;
  tone: 'up' | 'down' | 'warn' | 'stable' | 'fit' | 'risk';
  players: StaffDashboardPlayer[];
  valueLabel: (player: StaffDashboardPlayer) => string;
}): React.ReactElement {
  return (
    <section className="fc-staff-dashboard__section">
      <h2 className={`fc-staff-dashboard__heading fc-staff-dashboard__heading--${tone}`}>
        {title}
      </h2>
      <ul className="fc-staff-dashboard__list">
        {players.map((player) => (
          <li key={player.id}>
            <a
              href={`/player/${encodeURIComponent(player.slug)}`}
              className="fc-staff-dashboard__link"
            >
              {player.name} — {valueLabel(player)}
            </a>
          </li>
        ))}
        {players.length === 0 && (
          <li className="fc-staff-dashboard__empty">No data in this window.</li>
        )}
      </ul>
    </section>
  );
}

export default function StaffDashboardPage(): React.ReactElement {
  const [data, setData] = useState<StaffDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load(isInitial: boolean) {
      if (isInitial) {
        setLoading(true);
        setError(null);
      }

      try {
        const dashboard = await fetchStaffDashboard();
        if (!cancelled) {
          setData(dashboard);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard.');
        }
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    }

    void load(true);
    timer = setInterval(() => void load(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  if (loading) {
    return (
      <div className="fc-staff-dashboard-wrap">
        <p className="fc-staff-dashboard__status">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fc-staff-dashboard-wrap">
        <p className="fc-staff-dashboard__error">{error ?? 'Failed to load dashboard.'}</p>
      </div>
    );
  }

  return (
    <div className="fc-staff-dashboard-wrap" data-testid="staff-dashboard-page">
      <nav className="fc-futurecast-nav">
        <a href="/futurecast" className="fc-futurecast-nav__link">
          Predictions
        </a>
        <a href="/alerts" className="fc-futurecast-nav__link">
          Alerts
        </a>
        <a href="/staff/dashboard" className="fc-futurecast-nav__link is-active">
          Staff Dashboard
        </a>
      </nav>
      <h1 className="fc-staff-dashboard__title">Staff Dashboard</h1>
      <p className="fc-staff-dashboard__subtitle">FutureCast internal analytics hub</p>

      <div className="fc-staff-dashboard__heatmap">
        <MovementHeatmap buckets={data.heatmap.buckets} windowDays={data.heatmap.windowDays} />
      </div>

      <div className="fc-staff-dashboard">
        <PlayerLinks
          title={`Top Risers (${data.movementWindowDays} Days)`}
          tone="up"
          players={data.topRisers}
          valueLabel={(player) => `+${player.delta ?? 0}%`}
        />
        <PlayerLinks
          title={`Top Fallers (${data.movementWindowDays} Days)`}
          tone="down"
          players={data.topFallers}
          valueLabel={(player) => `${player.delta ?? 0}%`}
        />
        <PlayerLinks
          title="High Volatility"
          tone="warn"
          players={data.highVolatility}
          valueLabel={(player) => String(player.volatilityScore ?? 0)}
        />
        <PlayerLinks
          title="Stable Targets"
          tone="stable"
          players={data.lowVolatility}
          valueLabel={(player) => String(player.volatilityScore ?? 0)}
        />
        <PlayerLinks
          title="Fit Score Leaders"
          tone="fit"
          players={data.fitLeaders}
          valueLabel={(player) => String(player.ufFitScore ?? '—')}
        />
        <PlayerLinks
          title="Fit Score Risks"
          tone="risk"
          players={data.fitRisks}
          valueLabel={(player) => String(player.ufFitScore ?? '—')}
        />
        <section className="fc-staff-dashboard__section fc-staff-dashboard__section--wide">
          <h2 className="fc-staff-dashboard__heading">Recent Alerts</h2>
          <div className="fc-staff-dashboard__alerts">
            {data.alerts.map((alert) => (
              <article key={alert.id} className="fc-staff-dashboard__alert">
                <p className="fc-staff-dashboard__alert-message">{alert.message}</p>
                <p className="fc-staff-dashboard__alert-meta">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
            {data.alerts.length === 0 && (
              <p className="fc-staff-dashboard__empty">No recent alerts.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

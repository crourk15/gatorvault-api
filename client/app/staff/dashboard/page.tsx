'use client';

/**
 * Staff dashboard — internal FutureCast control room.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { UiError } from '@/components/site/UiMessage';
import { MovementHeatmap } from '@/components/futurecast/MovementHeatmap';
import {
  fetchStaffDashboard,
  type StaffDashboardPlayer,
  type StaffDashboardResponse,
} from '@/lib/staff-api';
import { playerProfilePath } from '@/lib/player-routes';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import '@/lib/futurecast.css';

const REFRESH_MS = 60_000;

function PlayerLinks({
  title,
  tone,
  players,
  valueLabel,
  inVault,
}: {
  title: string;
  tone: 'up' | 'down' | 'warn' | 'stable' | 'fit' | 'risk';
  players: StaffDashboardPlayer[];
  valueLabel: (player: StaffDashboardPlayer) => string;
  inVault: boolean;
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
              href={playerProfilePath(player.slug, player.lifecycle ?? 'HIGH_SCHOOL', inVault)}
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
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const backHref = inVault ? '/vault/futurecast' : '/futurecast';
  const [data, setData] = useState<StaffDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }

    try {
      const dashboard = await fetchStaffDashboard();
      setData(dashboard);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the staff dashboard.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function run(isInitial: boolean) {
      if (cancelled) return;
      await load(isInitial);
    }

    void run(true);
    timer = setInterval(() => void run(false), REFRESH_MS);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [load]);

  if (loading) {
    return (
      <div className="fc-staff-dashboard-wrap">
        <FutureCastSubNav active="staff" />
        <p className="fc-staff-dashboard__status">Loading dashboard…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="fc-staff-dashboard-wrap">
        <FutureCastSubNav active="staff" />
        <UiError
          title="Movement Intel unavailable"
          message={
            error ??
            'FutureCast database may be offline. This page is not the admin console — use /admin/product-health with your ops PIN for platform analytics.'
          }
          retry={() => void load(true)}
          backHref={backHref}
          backLabel="← FutureCast"
        />
      </div>
    );
  }

  return (
    <div className="fc-staff-dashboard-wrap" data-testid="staff-dashboard-page">
      <FutureCastSubNav active="staff" />
      <h1 className="fc-staff-dashboard__title">Movement Intel</h1>
      <p className="fc-staff-dashboard__subtitle">
        FutureCast risers, fallers, and fit scores. Admin analytics and Autoposter live at{' '}
        <a href="/admin/product-health">/admin/product-health</a> (ops PIN required).
      </p>

      <div className="fc-staff-dashboard__heatmap">
        <MovementHeatmap buckets={data.heatmap.buckets} windowDays={data.heatmap.windowDays} />
      </div>

      <div className="fc-staff-dashboard">
        <PlayerLinks
          title={`Top Risers (${data.movementWindowDays} Days)`}
          tone="up"
          players={data.topRisers}
          valueLabel={(player) => `+${player.delta ?? 0}%`}
          inVault={inVault}
        />
        <PlayerLinks
          title={`Top Fallers (${data.movementWindowDays} Days)`}
          tone="down"
          players={data.topFallers}
          valueLabel={(player) => `${player.delta ?? 0}%`}
          inVault={inVault}
        />
        <PlayerLinks
          title="High Volatility"
          tone="warn"
          players={data.highVolatility}
          valueLabel={(player) => String(player.volatilityScore ?? 0)}
          inVault={inVault}
        />
        <PlayerLinks
          title="Stable Targets"
          tone="stable"
          players={data.lowVolatility}
          valueLabel={(player) => String(player.volatilityScore ?? 0)}
          inVault={inVault}
        />
        <PlayerLinks
          title="Fit Score Leaders"
          tone="fit"
          players={data.fitLeaders}
          valueLabel={(player) => String(player.ufFitScore ?? '—')}
          inVault={inVault}
        />
        <PlayerLinks
          title="Fit Score Risks"
          tone="risk"
          players={data.fitRisks}
          valueLabel={(player) => String(player.ufFitScore ?? '—')}
          inVault={inVault}
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

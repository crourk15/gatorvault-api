'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { UiEmpty, UiError } from '@/components/site/UiMessage';
import { fetchAlerts, type FutureCastAlert } from '@/lib/alerts-api';
import { playerProfilePath } from '@/lib/player-routes';
import { usePathname } from '@/lib/use-pathname';
import { isVaultPath } from '@/lib/vault-routes';
import '@/lib/futurecast.css';

const REFRESH_MS = 60_000;

export function AlertsFeed(): React.ReactElement {
  const pathname = usePathname();
  const inVault = isVaultPath(pathname);
  const [alerts, setAlerts] = useState<FutureCastAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }

    try {
      const rows = await fetchAlerts();
      setAlerts(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load alerts. Try again in a moment.');
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
      <div className="fc-alerts-wrap">
        <FutureCastSubNav active="alerts" />
        <p className="fc-alerts__status">Loading alerts…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fc-alerts-wrap">
        <FutureCastSubNav active="alerts" />
        <UiError
          title="Alerts unavailable"
          message={error}
          retry={() => void load(true)}
          backHref="/"
          backLabel="← Back to GatorVault"
        />
      </div>
    );
  }

  return (
    <div className="fc-alerts-wrap" data-testid="alerts-page">
      <FutureCastSubNav active="alerts" />
      <h1 className="fc-alerts__title">Alerts</h1>
      <div className="fc-alerts__list">
        {alerts.map((alert) => (
          <article key={alert.id} className="fc-alerts__item">
            <a href={playerProfilePath(alert.playerSlug, 'HIGH_SCHOOL', inVault)} className="fc-alerts__message">
              {alert.message}
            </a>
            <p className="fc-alerts__meta">
              {alert.type} · {alert.playerName}
            </p>
          </article>
        ))}
        {alerts.length === 0 && (
          <UiEmpty message="No players found for this category yet." hint="Alerts appear when model confidence or fit scores move." />
        )}
      </div>
    </div>
  );
}

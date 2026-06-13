'use client';

/**
 * Global FutureCast alerts feed — /alerts
 */
import React, { useEffect, useState } from 'react';
import { FutureCastSubNav } from '@/components/site/FutureCastSubNav';
import { fetchAlerts, type FutureCastAlert } from '@/lib/alerts-api';
import '@/lib/futurecast.css';

const REFRESH_MS = 60_000;

export default function AlertsPage(): React.ReactElement {
  const [alerts, setAlerts] = useState<FutureCastAlert[]>([]);
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
        const rows = await fetchAlerts();
        if (!cancelled) {
          setAlerts(rows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error loading alerts.');
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
      <div className="fc-alerts-wrap">
        <p className="fc-alerts__status">Loading alerts…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fc-alerts-wrap">
        <p className="fc-alerts__error">{error}</p>
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
            <a
              href={`/player/${encodeURIComponent(alert.playerSlug)}`}
              className="fc-alerts__message"
            >
              {alert.message}
            </a>
            <p className="fc-alerts__meta">
              {alert.type} · {alert.playerName}
            </p>
          </article>
        ))}
        {alerts.length === 0 && (
          <p className="fc-alerts__status">No alerts yet.</p>
        )}
      </div>
    </div>
  );
}

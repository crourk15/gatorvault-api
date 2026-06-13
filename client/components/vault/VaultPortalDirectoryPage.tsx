'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PortalWatchlistGrid } from '@/components/futurecast/PortalWatchlistGrid';
import { fetchPortalIncoming, type PortalIncomingPlayer } from '@/lib/recruiting-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

export function VaultPortalDirectoryPage(): React.ReactElement {
  const [incoming, setIncoming] = useState<PortalIncomingPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchPortalIncoming(48);
      setIncoming(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load portal players.');
      setIncoming([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="gv-portal-directory" data-testid="vault-portal">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Portal Radar</h1>
        <p className="gv-page-subtitle">
          Incoming transfers and portal watchlist.{' '}
          <a href="/vault/futurecast">FutureCast Portal Watchlist →</a>
        </p>
      </div>

      <section className="gv-portal-incoming">
        <div className="gv-portal-incoming__header">
          <h2 className="gv-vault-alerts__section-title">
            Incoming Transfers — {loading ? '…' : incoming.length}
          </h2>
          <span className="gv-portal-badge">Source: On3 / Portal Intel</span>
        </div>
        {loading && <p className="gv-page-status">Loading portal directory…</p>}
        {error && !loading && (
          <UiError message={error} retry={() => void load()} backHref="/vault/futurecast" backLabel="← FutureCast" />
        )}
        {!loading && !error && incoming.length === 0 && (
          <UiEmpty message="No incoming portal players yet." />
        )}
        {!loading && !error && incoming.length > 0 && (
          <ul className="gv-portal-incoming__list">
            {incoming.map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'PORTAL', true)} className="gv-portal-incoming__row">
                  <span className="gv-portal-incoming__name">{p.fullName}</span>
                  <span className="gv-portal-incoming__meta">
                    {p.position} · {p.classYear}
                    {p.previousSchool ? ` · from ${p.previousSchool}` : ''}
                  </span>
                  {p.ufFitScore != null && p.ufFitScore > 0 && (
                    <span className="gv-portal-incoming__fit">UF Fit {Number(p.ufFitScore).toFixed(1)}</span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gv-portal-watchlist-section">
        <h2 className="gv-vault-alerts__section-title">Portal Watchlist</h2>
        <PortalWatchlistGrid query={{ limit: 12, sort: 'likelihood' }} />
      </section>
    </div>
  );
}

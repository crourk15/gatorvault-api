'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  DEPTH_BY_PHASE,
  DEPTH_PHASE_LABELS,
  type DepthChartRow,
  type DepthPhase,
} from '@/lib/depth-chart-data';
import { fetchRosterPlayers, type RosterPlayer } from '@/lib/roster-api';
import { TEAM_ERAS } from '@/lib/team-history-data';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

function statusLabel(status: string): string {
  if (status === 'locked') return '🟢 Locked';
  if (status === 'battle') return '🟡 Battle';
  return '🔴 Watch';
}

function DepthCard({ row }: { row: DepthChartRow }): React.ReactElement {
  return (
    <article className={`gv-dc-card gv-dc-card--${row.status}`}>
      <div className="gv-dc-card__header">
        <span className="gv-dc-card__pos">{row.pos}</span>
        <span className="gv-dc-card__status">{statusLabel(row.status)}</span>
      </div>
      <p className="gv-dc-card__starter">
        <strong>1st:</strong> {row.s} <span className="gv-dc-card__meta">{row.si}</span>
      </p>
      {row.b && row.b !== '—' && (
        <p className="gv-dc-card__backup">
          <strong>2nd:</strong> {row.b} <span className="gv-dc-card__meta">{row.bi}</span>
        </p>
      )}
      {row.third ? <p className="gv-dc-card__third">3rd: {row.third}</p> : null}
      <p className="gv-dc-card__analysis">{row.analysis}</p>
    </article>
  );
}

export function VaultDepthChartPage(): React.ReactElement {
  const [phase, setPhase] = useState<DepthPhase>('off');
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEra, setExpandedEra] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const players = await fetchRosterPlayers();
      setRoster(players);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load roster.');
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = DEPTH_BY_PHASE[phase];

  return (
    <div className="gv-depth-chart" data-testid="vault-depth-chart">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">2026 Depth Chart & Team Hub</h1>
        <p className="gv-page-subtitle">Spring projections · Program history, roster, and depth chart.</p>
      </div>

      <section className="gv-depth-chart__eras">
        <h2 className="gv-vault-alerts__section-title">Program History</h2>
        <div className="gv-era-track">
          {TEAM_ERAS.map((era) => (
            <div key={era.id} className="gv-era-card">
              <button
                type="button"
                className="gv-era-card__toggle"
                onClick={() => setExpandedEra(expandedEra === era.id ? null : era.id)}
              >
                <span className="gv-era-card__label">{era.label}</span>
                <span className="gv-era-card__title">{era.title}</span>
              </button>
              {expandedEra === era.id && (
                <div className="gv-era-card__body">
                  <p>{era.summary}</p>
                  <ul>
                    {era.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="gv-depth-chart__dc">
        <div className="gv-depth-chart__dc-header">
          <h2 className="gv-vault-alerts__section-title">Depth Chart</h2>
          <div className="gv-alert-choices">
            {(Object.keys(DEPTH_PHASE_LABELS) as DepthPhase[]).map((p) => (
              <button
                key={p}
                type="button"
                className={`gv-alert-choice${phase === p ? ' is-active' : ''}`}
                onClick={() => setPhase(p)}
              >
                {DEPTH_PHASE_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
        <div className="gv-dc-grid">
          {rows.map((row) => (
            <DepthCard key={row.pos} row={row} />
          ))}
        </div>
      </section>

      <section className="gv-depth-chart__roster">
        <h2 className="gv-vault-alerts__section-title">Spring Roster</h2>
        {loading && <p className="gv-page-status">Loading roster…</p>}
        {error && !loading && (
          <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
        )}
        {!loading && !error && roster.length === 0 && (
          <UiEmpty message="No roster players loaded yet." hint="Check /api/roster/players on the API." />
        )}
        {!loading && !error && roster.length > 0 && (
          <div className="gv-roster-grid">
            {roster.slice(0, 60).map((p) => (
              <a
                key={p.slug}
                href={playerProfilePath(p.slug, 'ROSTER', true)}
                className="gv-roster-card"
              >
                <span className="gv-roster-card__name">{p.name}</span>
                <span className="gv-roster-card__meta">
                  {p.pos || p.position} · {p.year || p.class}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

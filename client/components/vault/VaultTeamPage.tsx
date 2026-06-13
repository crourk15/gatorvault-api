'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEPTH_BY_PHASE,
  DEPTH_PHASE_LABELS,
  type DepthChartRow,
  type DepthPhase,
} from '@/lib/depth-chart-data';
import {
  fetchRosterPlayers,
  isPortalRosterPlayer,
  portalRosterLabel,
  type RosterPlayer,
} from '@/lib/roster-api';
import { playerProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const ACE_PORTAL_SLUG = 'eric-singleton-jr';

type TeamTab = 'roster' | 'depth';

function statusLabel(status: string): string {
  if (status === 'locked') return 'Locked';
  if (status === 'battle') return 'Battle';
  return 'Watch';
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

function groupByUnit(players: RosterPlayer[]): Record<string, RosterPlayer[]> {
  const groups: Record<string, RosterPlayer[]> = {
    offense: [],
    defense: [],
    special: [],
    other: [],
  };
  for (const p of players) {
    const unit = String(p.unit ?? 'other').toLowerCase();
    if (unit.includes('off')) groups.offense.push(p);
    else if (unit.includes('def')) groups.defense.push(p);
    else if (unit.includes('special')) groups.special.push(p);
    else groups.other.push(p);
  }
  return groups;
}

function RosterRow({ player }: { player: RosterPlayer }): React.ReactElement {
  const portalTag = portalRosterLabel(player);
  const isAce = player.slug === ACE_PORTAL_SLUG;
  const href = playerProfilePath(player.slug, 'ROSTER', true, player.name);

  return (
    <a
      href={href}
      className={`gv-team-roster-row${isAce ? ' gv-team-roster-row--ace' : ''}${isPortalRosterPlayer(player) ? ' gv-team-roster-row--portal' : ''}`}
    >
      <span className="gv-team-roster-row__pos">{player.pos || player.position}</span>
      <span className="gv-team-roster-row__name">
        {player.name}
        {isAce && <span className="gv-team-roster-row__ace">ACE</span>}
      </span>
      {portalTag && <span className="gv-team-roster-row__portal">{portalTag}</span>}
      <span className="gv-team-roster-row__meta">
        {player.year || player.class} · {player.height}/{player.weight}
      </span>
    </a>
  );
}

export function VaultTeamPage(): React.ReactElement {
  const [tab, setTab] = useState<TeamTab>(() => {
    if (typeof window === 'undefined') return 'roster';
    const t = new URLSearchParams(window.location.search).get('tab');
    return t === 'depth' ? 'depth' : 'roster';
  });
  const [phase, setPhase] = useState<DepthPhase>('off');
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoster(await fetchRosterPlayers());
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

  const grouped = useMemo(() => groupByUnit(roster), [roster]);
  const rows = DEPTH_BY_PHASE[phase];

  return (
    <div className="gv-team-page" data-testid="vault-team">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Team</h1>
        <p className="gv-page-subtitle">
          2026 roster, depth chart, and portal arrivals.{' '}
          <a href="/vault/recruiting">Recruiting Hub →</a> ·{' '}
          <a href="/vault/futurecast">FutureCast →</a>
        </p>
      </div>

      <div className="gv-hub-tabs">
        <button type="button" className={`gv-hub-tab${tab === 'roster' ? ' is-active' : ''}`} onClick={() => setTab('roster')}>
          Full Roster
        </button>
        <button type="button" className={`gv-hub-tab${tab === 'depth' ? ' is-active' : ''}`} onClick={() => setTab('depth')}>
          Depth Chart
        </button>
      </div>

      {loading && <p className="gv-page-status">Loading team…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Dashboard" />
      )}

      {!loading && !error && tab === 'roster' && (
        <div className="gv-team-roster">
          {(['offense', 'defense', 'special', 'other'] as const).map((unit) => {
            const list = grouped[unit];
            if (!list.length) return null;
            return (
              <section key={unit} className="gv-team-roster__group">
                <h2 className="gv-vault-alerts__section-title">
                  {unit.charAt(0).toUpperCase() + unit.slice(1)} ({list.length})
                </h2>
                <div className="gv-team-roster__list">
                  {list.map((p) => (
                    <RosterRow key={p.slug || p.id} player={p} />
                  ))}
                </div>
              </section>
            );
          })}
          {roster.length === 0 && <UiEmpty message="No roster data yet." />}
        </div>
      )}

      {!loading && !error && tab === 'depth' && (
        <>
          <div className="gv-depth-chart__phase-tabs">
            {(Object.keys(DEPTH_PHASE_LABELS) as DepthPhase[]).map((ph) => (
              <button
                key={ph}
                type="button"
                className={`gv-alert-choice${phase === ph ? ' is-active' : ''}`}
                onClick={() => setPhase(ph)}
              >
                {DEPTH_PHASE_LABELS[ph]}
              </button>
            ))}
          </div>
          <div className="gv-dc-grid">
            {rows.map((row) => (
              <DepthCard key={`${row.pos}-${row.s}`} row={row} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

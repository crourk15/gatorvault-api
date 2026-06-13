'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchScoutingDatabase,
  scoutingTypeLabel,
  type ScoutingBreakdown,
} from '@/lib/scouting-api';
import { scoutingProfilePath } from '@/lib/player-routes';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const TYPE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'recruit', label: 'Recruits' },
  { id: 'commit', label: 'Commits' },
  { id: 'portal', label: 'Portal' },
  { id: 'target', label: 'Targets' },
  { id: 'roster', label: 'Roster' },
];

function ScoutingProfileCard({ breakdown }: { breakdown: ScoutingBreakdown }): React.ReactElement {
  const slug = breakdown.playerSlug;
  const locked = breakdown.locked;
  const profileHref = scoutingProfilePath(slug, breakdown.playerType);

  return (
    <article className="gv-scout-card">
      <div className="gv-scout-card__header">
        <div>
          <h3 className="gv-scout-card__name">{breakdown.playerName || slug}</h3>
          <p className="gv-scout-card__type">
            {scoutingTypeLabel(breakdown.playerType)}
            {breakdown.featured ? ' · Featured' : ''}
          </p>
        </div>
        {locked ? (
          <span className="gv-scout-card__lock">War Room</span>
        ) : (
          <a href={profileHref} className="gv-scout-card__link">
            Profile →
          </a>
        )}
      </div>
      {breakdown.sources && breakdown.sources.length > 0 && (
        <p className="gv-scout-card__sources">{breakdown.sources.join(' · ')}</p>
      )}
      {!locked && breakdown.strengths && (
        <div className="gv-scout-card__report">
          <h4>Strengths</h4>
          <p>{breakdown.strengths}</p>
          {breakdown.weaknesses && (
            <>
              <h4>Weaknesses</h4>
              <p>{breakdown.weaknesses}</p>
            </>
          )}
          {breakdown.projection && (
            <>
              <h4>Projection</h4>
              <p>{breakdown.projection}</p>
            </>
          )}
        </div>
      )}
      {locked && (
        <p className="gv-scout-card__teaser">
          Upgrade to War Room for full scouting reports from verified analysts.
        </p>
      )}
    </article>
  );
}

export function ScoutingDepartmentPage(): React.ReactElement {
  const [list, setList] = useState<ScoutingBreakdown[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [view, setView] = useState<'hub' | 'reports' | 'queue' | 'directory'>('hub');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchScoutingDatabase(type === 'all' ? undefined : type);
      setList(data.breakdowns || []);
      setLocked(!!data.locked);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scouting database.');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((b) => {
      const hay = [b.playerName, b.playerSlug, b.playerType].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [list, search]);

  const featuredReports = useMemo(
    () => filtered.filter((b) => b.featured && !b.locked && b.strengths),
    [filtered]
  );

  const evalQueue = useMemo(
    () =>
      filtered.filter(
        (b) =>
          !b.locked &&
          (b.playerType === 'target' || b.playerType === 'recruit') &&
          !b.strengths
      ),
    [filtered]
  );

  return (
    <div className="gv-page" data-testid="scouting-page">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Scouting Department</h1>
        <p className="gv-page-subtitle">
          Verified evaluations from trusted analysts — recruits, commits, portal, and targets.
        </p>
      </div>

      <div className="gv-scout-hub">
        <a href="/players" className="gv-scout-hub__card">
          <span className="gv-scout-hub__icon">📋</span>
          <h2>Player Directory</h2>
          <p>Search HS recruits, portal, and college players with filters and profile links.</p>
        </a>
        <button
          type="button"
          className={`gv-scout-hub__card${view === 'reports' ? ' is-active' : ''}`}
          onClick={() => setView('reports')}
        >
          <span className="gv-scout-hub__icon">📊</span>
          <h2>Scouting Reports</h2>
          <p>Featured evaluations with strengths, weaknesses, and projections.</p>
        </button>
        <button
          type="button"
          className={`gv-scout-hub__card${view === 'queue' ? ' is-active' : ''}`}
          onClick={() => setView('queue')}
        >
          <span className="gv-scout-hub__icon">⏳</span>
          <h2>Evaluation Queue</h2>
          <p>Targets and recruits awaiting full War Room write-ups.</p>
        </button>
        <button
          type="button"
          className={`gv-scout-hub__card${view === 'directory' ? ' is-active' : ''}`}
          onClick={() => setView('directory')}
        >
          <span className="gv-scout-hub__icon">🔍</span>
          <h2>Full Database</h2>
          <p>Browse all scouting profiles by type with search.</p>
        </button>
      </div>

      {(view === 'directory' || view === 'hub') && (
        <>
          <div className="gv-page-tabs">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`gv-page-tab${type === tab.id ? ' is-active' : ''}`}
                onClick={() => setType(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="gv-page-toolbar">
            <input
              type="search"
              className="gv-page-search"
              placeholder="Search scouting database…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </>
      )}

      {locked && (
        <div className="gv-page-notice">
          Preview mode — full War Room reports require Insider access. Player names and categories are visible below.
        </div>
      )}

      {loading && <p className="gv-page-status">Loading scouting database…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/" backLabel="← GatorVault Home" />
      )}

      {!loading && !error && view === 'reports' && (
        <section className="gv-page-section">
          <div className="gv-page-section__header">
            <h2 className="gv-page-section__title">Featured Scouting Reports</h2>
            <p className="gv-page-section__subtitle">{featuredReports.length} reports</p>
          </div>
          {featuredReports.length > 0 ? (
            <div className="gv-scout-list">
              {featuredReports.map((b) => (
                <ScoutingProfileCard key={b.playerSlug} breakdown={b} />
              ))}
            </div>
          ) : (
            <UiEmpty message="No featured reports in this view yet." />
          )}
        </section>
      )}

      {!loading && !error && view === 'queue' && (
        <section className="gv-page-section">
          <div className="gv-page-section__header">
            <h2 className="gv-page-section__title">Evaluation Queue</h2>
            <p className="gv-page-section__subtitle">{evalQueue.length} pending</p>
          </div>
          {evalQueue.length > 0 ? (
            <div className="gv-scout-list">
              {evalQueue.map((b) => (
                <ScoutingProfileCard key={b.playerSlug} breakdown={b} />
              ))}
            </div>
          ) : (
            <UiEmpty message="Evaluation queue is clear — all targets have reports." />
          )}
        </section>
      )}

      {!loading && !error && (view === 'directory' || view === 'hub') && (
        <section className="gv-page-section">
          <div className="gv-page-section__header">
            <h2 className="gv-page-section__title">Scouting Profiles</h2>
            <p className="gv-page-section__subtitle">{filtered.length} evaluations</p>
          </div>
          {filtered.length > 0 ? (
            <div className="gv-scout-list">
              {filtered.map((b) => (
                <ScoutingProfileCard key={b.playerSlug} breakdown={b} />
              ))}
            </div>
          ) : (
            <UiEmpty message="No scouting profiles in this category yet." />
          )}
        </section>
      )}
    </div>
  );
}

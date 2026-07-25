'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { BigBoardGrid } from '@/components/futurecast/BigBoardGrid';
import { EarlyDiscoveryGrid } from '@/components/futurecast/EarlyDiscoveryGrid';
import { PortalWatchlistGrid } from '@/components/futurecast/PortalWatchlistGrid';
import { UfFitWatchlistGrid } from '@/components/futurecast/UfFitWatchlistGrid';
import { TAB_SORT, type BigBoardQuery } from '@/lib/big-board-api';
import { getPortalSeasonState, shouldShowPortalWatchlist } from '@/lib/recruiting-cycle';
type BigBoardTabId = 'top-targets' | 'early-discovery' | 'portal-watchlist' | 'rank';

const ALL_TABS: { id: BigBoardTabId; label: string }[] = [
  { id: 'rank', label: 'Intelligence Rank' },
  { id: 'top-targets', label: 'Top Targets' },
  { id: 'early-discovery', label: 'Early Discovery' },
  { id: 'portal-watchlist', label: 'Portal Watchlist' },
];

const CLASS_YEARS = [2027, 2028, 2029];
const POSITIONS = ['', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'EDGE', 'LB', 'CB', 'S', 'ATH'];

function defaultBigBoardTab(): BigBoardTabId {
  return shouldShowPortalWatchlist(getPortalSeasonState()) ? 'top-targets' : 'early-discovery';
}

function tabQuery(tab: BigBoardTabId, classYear: number, position: string): BigBoardQuery {
  const preset = TAB_SORT[tab === 'rank' ? 'rank' : tab] ?? TAB_SORT.rank;
  return {
    class_year: classYear,
    position: position || undefined,
    lifecycle: preset.lifecycle,
    sort: preset.sort,
    order: preset.sort === 'name' || preset.sort === 'position' ? 'asc' : 'desc',
    limit: 200,
  };
}

export function FutureCastBigBoardPage(): React.ReactElement {
  const portalSeason = useMemo(() => getPortalSeasonState(), []);
  const tabs = useMemo(
    () =>
      ALL_TABS.filter(
        (tab) => tab.id !== 'portal-watchlist' || shouldShowPortalWatchlist(portalSeason)
      ),
    [portalSeason]
  );
  const [classYear, setClassYear] = useState(
    shouldShowPortalWatchlist(portalSeason) ? 2027 : 2028
  );
  const [position, setPosition] = useState('');
  const [minDiscoveryScore, setMinDiscoveryScore] = useState(50);
  const [activeTab, setActiveTab] = useState<BigBoardTabId>(defaultBigBoardTab());

  useEffect(() => {
    if (activeTab === 'portal-watchlist' && !shouldShowPortalWatchlist(portalSeason)) {
      setActiveTab('early-discovery');
      setClassYear(2028);
    }
  }, [activeTab, portalSeason]);

  const classYearOptions =
    activeTab === 'early-discovery' ? CLASS_YEARS.filter((y) => y >= 2028) : CLASS_YEARS;

  const handleTabChange = (tab: BigBoardTabId) => {
    setActiveTab(tab);
    if (tab === 'early-discovery' && classYear < 2028) {
      setClassYear(2028);
    }
  };

  const query = useMemo(
    () => tabQuery(activeTab, classYear, position),
    [activeTab, classYear, position]
  );

  const earlyDiscoveryClassGte = activeTab === 'early-discovery' ? classYear : Math.max(classYear, 2028);

  const earlyDiscoveryQuery = useMemo(
    () => ({
      class_year_gte: earlyDiscoveryClassGte,
      min_discovery_score: minDiscoveryScore,
      limit: 100,
      position: position || undefined,
    }),
    [earlyDiscoveryClassGte, minDiscoveryScore, position]
  );

  return (
    <div className="rh-frame" data-testid="vault-futurecast-big-board">
      <header style={{ marginBottom: '1rem' }}>
        <h1 className="rh-elite-section__title" style={{ margin: 0 }}>
          FutureCast Big Board
        </h1>
        <p className="rh-elite-section__sub" style={{ margin: '0.35rem 0 0' }}>
          UF Fit Score™, portal likelihood, and discovery signals — Postgres-backed Phase 1 feed
        </p>
      </header>

      <nav className="fc-futurecast-nav" aria-label="Big Board tabs" style={{ marginBottom: '1rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`fc-futurecast-nav__link${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'early-discovery' ? (
        <p className="rh-elite-section__sub" style={{ margin: '0 0 0.75rem' }}>
          Early Discovery ranks {classYear}+ underclassmen by discovery score (Vault est. ratings until On3 sync).
        </p>
      ) : null}

      {!shouldShowPortalWatchlist(portalSeason) ? (
        <p className="rh-elite-section__sub" style={{ margin: '0 0 0.75rem' }} data-testid="fc-portal-offseason-note">
          {portalSeason.label}
        </p>
      ) : null}

      <div className="fc-big-board-toolbar">
        <label>
          Class
          <select value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
            {classYearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => (
              <option key={p || 'all'} value={p}>
                {p || 'All'}
              </option>
            ))}
          </select>
        </label>
        {activeTab === 'early-discovery' ? (
          <label>
            Min discovery
            <select
              value={minDiscoveryScore}
              onChange={(e) => setMinDiscoveryScore(Number(e.target.value))}
            >
              <option value={70}>70+</option>
              <option value={50}>50+</option>
              <option value={40}>40+</option>
              <option value={0}>All scored</option>
            </select>
          </label>
        ) : null}
      </div>

      {activeTab === 'top-targets' ? (
        <UfFitWatchlistGrid
          query={{
            class_year: classYear,
            position: position || undefined,
            sort: 'ufFitScore',
            minScore: 50,
            limit: 100,
          }}
        />
      ) : activeTab === 'early-discovery' ? (
        <EarlyDiscoveryGrid query={earlyDiscoveryQuery} />
      ) : activeTab === 'portal-watchlist' ? (
        <PortalWatchlistGrid
          query={{
            class_year: classYear,
            position: position || undefined,
            sort: 'likelihood',
            limit: 100,
          }}
        />
      ) : (
        <BigBoardGrid query={query} />
      )}
    </div>
  );
}

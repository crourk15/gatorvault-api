'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchTeamHubBundle, type TeamHubBundle } from '@/lib/team-hub-api';
import type { Coach, DepthChartTab, Era } from '@/lib/team-hub-types';
import { TEAM_COPY } from '@/lib/team-hub-types';
import type { RosterFilter } from '@/lib/team-hub-data';
import { saveVaultPageState, useVaultDataReload, useVaultPageRestore } from '@/lib/vault-navigation';
import { UiError } from '@/components/site/UiMessage';
import { TeamHero } from '@/components/team/TeamHero';
import { ProgramHistoryTimeline } from '@/components/team/ProgramHistoryTimeline';
import { ProgramAchievementsStats } from '@/components/team/ProgramAchievementsStats';
import { TeamIdentitySection } from '@/components/team/TeamIdentitySection';
import { CoachingStaffGrid } from '@/components/team/CoachingStaffGrid';
import { CoachingStaffModal, EraDetailModal } from '@/components/team/CoachingStaffModal';
import { RosterFilters } from '@/components/team/RosterFilters';
import { RosterList } from '@/components/team/RosterList';
import { DepthChartTabs } from '@/components/team/DepthChartTabs';
import { DepthChartGrid } from '@/components/team/DepthChartGrid';
import { TeamFooter } from '@/components/team/TeamFooter';

const EMPTY_BUNDLE: TeamHubBundle = {
  eras: [],
  achievements: [],
  identity: [],
  coaches: [],
  roster: [],
  depthChart: { offense: [], defense: [], specialTeams: [] },
  updatedAt: null,
};

export function TeamHubPage(): React.ReactElement {
  const [bundle, setBundle] = useState<TeamHubBundle>(EMPTY_BUNDLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>('All');
  const [dcTab, setDcTab] = useState<DepthChartTab>('offense');
  const [selectedCoach, setSelectedCoach] = useState<Coach | null>(null);
  const [selectedEra, setSelectedEra] = useState<Era | null>(null);

  useVaultPageRestore('team', (saved) => {
    if (saved.rosterFilter && typeof saved.rosterFilter === 'string') {
      setRosterFilter(saved.rosterFilter as RosterFilter);
    }
  });

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) {
      setLoading(true);
      setError(null);
    }
    try {
      setBundle(await fetchTeamHubBundle());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load team hub.');
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
  }, [load]);

  useVaultDataReload(() => void load(false));

  useEffect(() => {
    const persist = () =>
      saveVaultPageState('team', {
        scrollY: window.scrollY,
        rosterFilter,
      });
    window.addEventListener('pagehide', persist);
    return () => window.removeEventListener('pagehide', persist);
  }, [rosterFilter]);

  useEffect(() => {
    document.body.classList.toggle('gv-team-modal-open', Boolean(selectedCoach || selectedEra));
    return () => document.body.classList.remove('gv-team-modal-open');
  }, [selectedCoach, selectedEra]);

  const dcPositions =
    dcTab === 'offense'
      ? bundle.depthChart.offense
      : dcTab === 'defense'
        ? bundle.depthChart.defense
        : bundle.depthChart.specialTeams;

  return (
    <div className="gv-team-hub" data-testid="vault-team">
      <TeamHero />

      {error && !loading && (
        <div className="gv-team-hub__section gv-team-hub__frame">
          <UiError message={error} retry={() => void load(true)} backHref="/vault" backLabel="← Dashboard" />
        </div>
      )}

      {!error && (
        <>
          <ProgramHistoryTimeline eras={bundle.eras} onSelectEra={setSelectedEra} />
          <ProgramAchievementsStats achievements={bundle.achievements} />
          <TeamIdentitySection blocks={bundle.identity} />
          <CoachingStaffGrid coaches={bundle.coaches} onSelectCoach={setSelectedCoach} />

          <section className="gv-team-hub__section gv-team-hub__frame" id="roster" aria-label="Roster">
            <h2 className="gv-team-hub__section-title">{TEAM_COPY.roster.title}</h2>
            <p className="gv-team-hub__section-sub">{TEAM_COPY.roster.subtitle}</p>
            {loading && bundle.roster.length === 0 ? (
              <p className="gv-team-status">Loading roster…</p>
            ) : (
              <>
                <RosterFilters active={rosterFilter} onChange={setRosterFilter} />
                <RosterList players={bundle.roster} filter={rosterFilter} />
              </>
            )}
          </section>

          <section className="gv-team-hub__section gv-team-hub__frame" id="depth-chart" aria-label="Depth chart">
            <h2 className="gv-team-hub__section-title">{TEAM_COPY.depthChart.title}</h2>
            <p className="gv-team-hub__section-sub">{TEAM_COPY.depthChart.subtitle}</p>
            <div className="gv-team-dc-legend">
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--locked">Locked</span>
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--battle">Battle</span>
              <span className="gv-team-dc-legend-pill gv-team-dc-legend-pill--watch">Watch</span>
            </div>
            <DepthChartTabs active={dcTab} onChange={setDcTab} />
            <DepthChartGrid positions={dcPositions} />
          </section>

          <TeamFooter />
        </>
      )}

      <CoachingStaffModal coach={selectedCoach} onClose={() => setSelectedCoach(null)} />
      <EraDetailModal era={selectedEra} onClose={() => setSelectedEra(null)} />
    </div>
  );
}

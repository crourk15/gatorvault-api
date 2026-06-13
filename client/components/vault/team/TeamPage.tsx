'use client';

import React, { useCallback, useEffect } from 'react';
import { fetchRosterPlayers, type RosterPlayer } from '@/lib/roster-api';
import {
  saveVaultPageState,
  useVaultDataReload,
  useVaultPageRestore,
  type VaultPageState,
} from '@/lib/vault-navigation';
import { TeamSection } from './TeamSection';
import { TeamHistory } from './TeamHistory';
import { TeamAchievements } from './TeamAchievements';
import { TeamIdentity } from './TeamIdentity';
import { TeamCoachingStaff } from './TeamCoachingStaff';
import { TeamDepthChart } from './TeamDepthChart';
import { TeamRoster } from './TeamRoster';
import { TeamModal } from './TeamModal';
import { initTeamModule, wireTeamRosterNavigation } from '@/lib/team-bridge';

declare global {
  interface Window {
    playerProfiles?: RosterPlayer[];
    _gvTeamRosterFilter?: string;
    gvRenderTeam?: () => void;
    renderDC?: () => void;
  }
}

function mapPlayerProfiles(players: RosterPlayer[]): Array<RosterPlayer & { rating?: number; classYear?: string }> {
  return players.map((p) => ({
    ...p,
    rating: p.vaultGrade ?? undefined,
    classYear: p.year ?? p.class,
  }));
}

export function TeamPage(): React.ReactElement {
  const getTeamState = useCallback((): VaultPageState => {
    return {
      scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
      rosterFilter: window._gvTeamRosterFilter ?? 'All',
    };
  }, []);

  useVaultPageRestore('team', (saved) => {
    if (saved.rosterFilter) window._gvTeamRosterFilter = saved.rosterFilter;
  });

  const bootstrap = useCallback(async () => {
    try {
      const roster = await fetchRosterPlayers();
      window.playerProfiles = mapPlayerProfiles(roster);
    } catch {
      window.playerProfiles = [];
    }
    await initTeamModule();
    wireTeamRosterNavigation(getTeamState);
    const filter = window._gvTeamRosterFilter;
    if (filter && filter !== 'All') {
      document.querySelectorAll('#gv-team-roster-filters .gv-mteam-pos-chip').forEach((chip) => {
        const el = chip as HTMLElement;
        const pos = el.getAttribute('data-pos');
        el.classList.toggle('active', pos === filter);
      });
      if (typeof window.gvRenderTeam === 'function') window.gvRenderTeam();
    }
  }, [getTeamState]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useVaultDataReload(bootstrap);

  useEffect(() => {
    const onLeave = () => saveVaultPageState('team', getTeamState());
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, [getTeamState]);

  return (
    <>
      <div id="vpane-team" className="gv-team-page" data-testid="vault-team">
        <header className="gv-team-page-hdr">
          <h1 className="gv-team-page-title">🐊 Team</h1>
          <p className="gv-team-page-sub">
            Program history, coaching staff, roster, and depth chart — one hub for Gator Nation.
          </p>
        </header>

        <TeamSection
          title="Team Overview"
          titleAccent
          description="Five decades of Gator football · culture · championships"
        >
          <div className="gv-team-overview-layout">
            <div className="gv-team-overview-main">
              <TeamHistory />
              <TeamAchievements />
            </div>
            <div>
              <TeamIdentity />
            </div>
          </div>
        </TeamSection>

        <TeamCoachingStaff />
        <TeamDepthChart />
        <TeamRoster />
      </div>
      <TeamModal />
    </>
  );
}

'use client';

import React from 'react';
import type { PersonalizedResponse, RecruitingSnapshot, TickerItem } from '@/lib/vault-home-api';
import type { StaffDashboardResponse } from '@/lib/staff-api';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { SITE_ROUTES } from '@/lib/site-routes';
import { playerProfilePath } from '@/lib/player-routes';
import { HomeModuleCard } from '@/components/home/HomeModuleCard';
import './HomeRecruitingSnapshot.css';

type Props = {
  snapshot: RecruitingSnapshot | null;
  movement: StaffDashboardResponse | null;
  personalized: PersonalizedResponse | null;
  tickerItems: TickerItem[];
  loading?: boolean;
};

export function HomeRecruitingSnapshot({
  snapshot,
  movement,
  personalized,
  tickerItems,
  loading,
}: Props): React.ReactElement {
  if (loading || !snapshot) {
    return (
      <HomeModuleCard
        gridClass="gv-home__cell--6"
        eyebrow="Recruiting Hub"
        title={GV_COPY.headlines.recruitingSnapshot}
        ariaLabel="Recruiting snapshot"
        testId="home-recruiting"
        loading
        skeletonHeight={260}
      />
    );
  }

  const hotCount = movement?.topRisers?.length ?? Math.max(1, Math.floor(snapshot.targets / 4));
  const coolingCount = movement?.topFallers?.length ?? Math.max(1, Math.floor(snapshot.portalActive / 3));
  const flipCount = Math.max(0, snapshot.portalActive - snapshot.commits);

  const topTargets = (personalized?.watchlist ?? [])
    .slice(0, 3)
    .map((w) => w.label)
    .filter(Boolean);
  if (topTargets.length === 0) {
    topTargets.push('2027 WR priority board', 'Portal edge targets', 'Crystal Ball movers');
  }

  const intelLines = tickerItems
    .filter((i) => /recruit|commit|portal|visit|target/i.test(i.text))
    .slice(0, 3)
    .map((i) => i.text);
  if (intelLines.length === 0) {
    intelLines.push(`${snapshot.commits} commits on the board`, `${snapshot.targets} active targets tracked`);
  }

  const risers = movement?.topRisers?.slice(0, 2) ?? [];

  return (
    <HomeModuleCard
      gridClass="gv-home__cell--6"
      eyebrow="Recruiting Hub"
      title={GV_COPY.headlines.recruitingSnapshot}
      stats={[
        { value: String(snapshot.commits), label: 'Commits', tone: 'accent' },
        { value: String(snapshot.targets), label: 'Targets', tone: 'up' },
        { value: snapshot.classRank != null ? `#${snapshot.classRank}` : '—', label: 'Class rank', tone: 'neutral' },
      ]}
      link={{ href: `${SITE_ROUTES.recruiting}?tab=priority`, label: 'Open Recruiting Hub →' }}
      ariaLabel="Recruiting snapshot"
      testId="home-recruiting"
    >
      <div className="gv-home-recruit-panel__signals">
        <span className="gv-home-signal gv-home-signal--hot">Hot {hotCount}</span>
        <span className="gv-home-signal gv-home-signal--cooling">Cooling {coolingCount}</span>
        <span className="gv-home-signal gv-home-signal--flip">Flip Watch {flipCount}</span>
      </div>

      <div className="gv-home-recruit-panel__block">
        <h3 className="gv-home-recruit-panel__label">Top targets</h3>
        <ul className="gv-home-recruit-panel__list">
          {topTargets.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>

      <div className="gv-home-recruit-panel__block">
        <h3 className="gv-home-recruit-panel__label">Latest intel</h3>
        <ul className="gv-home-recruit-panel__list">
          {intelLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      {risers.length > 0 && (
        <div className="gv-home-recruit-panel__block">
          <h3 className="gv-home-recruit-panel__label">Movement</h3>
          <ul className="gv-home-recruit-panel__list">
            {risers.map((p) => (
              <li key={p.id}>
                <a href={playerProfilePath(p.slug, 'HIGH_SCHOOL', true, p.name, 'futurecast')}>{p.name}</a>
                <span className="gv-home-recruit-panel__delta gv-home-recruit-panel__delta--up">
                  ↑ +{p.delta ?? 0}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </HomeModuleCard>
  );
}

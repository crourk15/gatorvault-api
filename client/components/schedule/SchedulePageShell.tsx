'use client';

import React, { useMemo, useState } from 'react';
import { Container, Tabs } from '@/components/ui';
import {
  SCHEDULE_SECTION_META,
  SCHEDULE_SEASONS,
  gamesForSeason,
  groupGamesBySection,
  type ScheduleSeason,
} from '@/lib/schedule-premium';
import { GameSection } from './GameSection';
import { HeroSchedule } from './HeroSchedule';

type Props = {
  defaultSeason?: ScheduleSeason;
};

export function SchedulePageShell({ defaultSeason = '2026' }: Props): React.ReactElement {
  const [season, setSeason] = useState<ScheduleSeason>(defaultSeason);
  const games = useMemo(() => gamesForSeason(season), [season]);
  const grouped = useMemo(() => groupGamesBySection(games), [games]);

  return (
    <div className="gv-schedule-page gv-sched-page" data-testid="vault-schedule">
      <HeroSchedule
        title={`${season} Florida Gators Football Schedule`}
        subtitle="TV info, tickets, win probabilities, and game-week intel — all in one place."
        primaryCta={{ label: 'Buy Tickets', href: 'https://floridagators.com/tickets' }}
        secondaryCta={{ label: 'Download Schedule', href: 'https://floridagators.com/sports/football/schedule' }}
      />

      <Container className="gv-sched-page__body">
        <div className="gv-sched-filters" data-testid="schedule-filters">
          <Tabs
            options={SCHEDULE_SEASONS.map((y) => ({ id: y, label: y }))}
            active={season}
            onChange={(id) => setSeason(id as ScheduleSeason)}
            aria-label="Season year"
          />
          <div className="gv-sched-legend" aria-label="Win probability legend">
            <span className="gv-sched-legend__item gv-sched-legend__item--favored">UF favored</span>
            <span className="gv-sched-legend__item gv-sched-legend__item--tossup">Toss-up</span>
            <span className="gv-sched-legend__item gv-sched-legend__item--underdog">Underdog</span>
          </div>
        </div>

        {games.length === 0 ? (
          <p className="gv-sched-empty">The {season} schedule will be published soon.</p>
        ) : (
          SCHEDULE_SECTION_META.map((section) => (
            <GameSection
              key={section.id}
              title={section.title}
              description={section.description}
              games={grouped.get(section.id) ?? []}
            />
          ))
        )}
      </Container>
    </div>
  );
}

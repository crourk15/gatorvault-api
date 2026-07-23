'use client';

import React, { useMemo, useState } from 'react';
import { Container, Tabs } from '@/components/ui';
import {
  SCHEDULE_SECTION_META,
  SCHEDULE_SEASONS,
  gamesForSeason,
  getNextScheduleGame,
  getScheduleGameStatus,
  getSeasonModelSummary,
  groupGamesBySection,
  type ScheduleGameStatus,
  type ScheduleSeason,
} from '@/lib/schedule-premium';
import { GameSection } from './GameSection';
import { HeroSchedule } from './HeroSchedule';
import { NextUpMatchup } from './NextUpMatchup';
import { SeasonModelStrip } from './SeasonModelStrip';

type Props = {
  defaultSeason?: ScheduleSeason;
};

export function SchedulePageShell({ defaultSeason = '2026' }: Props): React.ReactElement {
  const [season, setSeason] = useState<ScheduleSeason>(
    SCHEDULE_SEASONS.includes(defaultSeason) ? defaultSeason : '2026',
  );
  const games = useMemo(() => gamesForSeason(season), [season]);
  const grouped = useMemo(() => groupGamesBySection(games), [games]);
  const nextGame = useMemo(() => getNextScheduleGame(games), [games]);
  const nextId = nextGame?.id ?? null;
  const seasonModel = useMemo(() => (games.length ? getSeasonModelSummary(games) : null), [games]);

  const statusById = useMemo(() => {
    const map: Record<string, ScheduleGameStatus> = {};
    for (const game of games) {
      map[game.id] = getScheduleGameStatus(game, nextId);
    }
    return map;
  }, [games, nextId]);

  return (
    <div className="gv-schedule-page gv-sched-page" data-testid="vault-schedule">
      <HeroSchedule
        season={season}
        subtitle="War Room win probabilities, model lean scores, tickets, and Game Week for every matchup."
        primaryCta={{ label: 'Buy Tickets', href: 'https://floridagators.com/tickets' }}
        secondaryCta={{ label: 'Official schedule', href: 'https://floridagators.com/sports/football/schedule' }}
        hideCtas={Boolean(nextGame)}
      >
        {nextGame ? <NextUpMatchup game={nextGame} /> : null}
      </HeroSchedule>

      <Container className="gv-sched-page__body">
        {seasonModel ? <SeasonModelStrip model={seasonModel} /> : null}
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
              statusById={statusById}
            />
          ))
        )}
      </Container>
    </div>
  );
}

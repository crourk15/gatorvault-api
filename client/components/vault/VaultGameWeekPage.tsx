'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card, GridLayout, PageLayout, PageSection, TabBar } from '@/components/brand';
import { FilmRoomGameWeekPanel } from '@/components/vault/FilmRoomGameWeekPanel';
import { InsiderPaywall } from '@/components/futurecast/InsiderPaywall';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';
import { usePathname } from '@/lib/use-pathname';
import { isFilmRoomInsider } from '@/lib/futurecast-insider';

const TABS = [
  { id: 'intel', label: 'Game Week Intel' },
  { id: 'depth', label: 'Depth Chart' },
];

const GAME_WEEK_PAYWALL = {
  message:
    'Game Week unlocks matchup intel, opponent film prep, swing-player notes, and GatorVault predictions.',
  ctaLabel: 'Unlock Game Week + Film Room',
} as const;

export function VaultGameWeekPage(): React.ReactElement {
  const pathname = usePathname();
  const insider = isFilmRoomInsider();
  const urlGameId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.gameWeekGame),
    [pathname]
  );
  const [gameId, setGameId] = useState('fau');
  const [tab, setTab] = useState('intel');

  useEffect(() => {
    if (urlGameId && SCHEDULE_GAMES.some((g) => g.id === urlGameId)) {
      setGameId(urlGameId);
    }
  }, [urlGameId]);

  return (
    <div className="rh-page rh-page--elite gv-film-room-page mobile-app" data-testid="vault-game-week-elite">
      <PageLayout
        theme="chalkboard"
        testId="vault-game-week"
        className="gv-film-room rh-elite-chrome"
        hero={
          <header className="gv-fr-hero">
            <h1 className="gv-fr-hero__title">Game Week</h1>
            <p className="gv-fr-hero__sub">Matchup spotlight, intel, and predictions — powered by FutureCast.</p>
          </header>
        }
      >
        <TabBar options={TABS} active={tab} onChange={setTab} aria-label="Game week sections" />

        {tab === 'intel' ? (
          <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
            <FilmRoomGameWeekPanel initialGameId={gameId} />
          </InsiderPaywall>
        ) : (
          <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
            <PageSection title="Projected depth chart" subtitle="From roster + snap trends">
              <Card variant="dark" className="gv-fr-gw-card">
                <p className="gv-fr-gw-card__body">Orange = projected starter · Blue = backup</p>
                <GridLayout cols={3}>
                  {['QB Jones Jr.', 'RB Baugh', 'WR Singleton Jr.', 'TE Graham', 'LT Frazier', 'EDGE Woods'].map(
                    (p, i) => (
                      <div key={p} className={i % 2 === 0 ? 'gv-gw-starter' : 'gv-gw-backup'}>
                        {p}
                      </div>
                    )
                  )}
                </GridLayout>
              </Card>
            </PageSection>
          </InsiderPaywall>
        )}

        {!insider ? (
          <a href="/join?tier=film" className="gv-paywall-sticky-cta">
            Unlock Game Week + Film Room · from $9.99/mo
          </a>
        ) : null}
      </PageLayout>
    </div>
  );
}

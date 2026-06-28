'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, GridLayout, PageLayout, PageSection, TabBar } from '@/components/brand';
import { InsiderPaywall } from '@/components/futurecast/InsiderPaywall';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';
import { isFilmRoomInsider } from '@/lib/futurecast-insider';

const TABS = [
  { id: 'intel', label: 'Game Week Intel' },
  { id: 'depth', label: 'Depth Chart' },
  { id: 'scout', label: 'Scouting Report' },
  { id: 'pred', label: 'Prediction Panel' },
];

function daysUntilKickoff(dateStr: string): number {
  const match = dateStr.match(/(\w+) (\d+), (\d{4})/);
  if (!match) return 0;
  const kick = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  return Math.max(0, Math.ceil((kick.getTime() - Date.now()) / 86400000));
}

function Countdown({ days }: { days: number }): React.ReactElement {
  return (
    <div className="gv-gw-countdown" data-testid="game-week-countdown">
      <span className="gv-gw-countdown__num">{days}</span>
      <span className="gv-gw-countdown__label">Days to Kickoff</span>
    </div>
  );
}

function MatchupHero({ game }: { game: ScheduleGame }): React.ReactElement {
  return (
    <div className="gv-gw-matchup">
      <div className="gv-gw-matchup__logo gv-gw-matchup__logo--uf" aria-hidden="true">
        🐊
      </div>
      <div className="gv-gw-matchup__center">
        <Chip variant="orange">{game.tv ?? 'TBD'}</Chip>
        <h2 className="gv-type-h2" style={{ margin: '0.5rem 0' }}>
          Florida vs {game.opp}
        </h2>
        <p className="gv-type-body" style={{ margin: 0, opacity: 0.85 }}>
          {game.date} · {game.venue}
        </p>
      </div>
      <div className="gv-gw-matchup__logo gv-gw-matchup__logo--opp" aria-hidden="true">
        {game.opp.slice(0, 2).toUpperCase()}
      </div>
    </div>
  );
}

function GameCard({ game }: { game: ScheduleGame }): React.ReactElement {
  const oppPct = 100 - game.ufPct;
  return (
    <Card className="gv-game-card">
      <PageSection title="Win Probability">
        <div className="gv-wp-bar">
          <div className="gv-wp-bar__uf" style={{ width: `${game.ufPct}%` }}>
            UF {game.ufPct}%
          </div>
          <div className="gv-wp-bar__opp" style={{ width: `${oppPct}%` }}>
            {oppPct}%
          </div>
        </div>
      </PageSection>
      <GridLayout cols={3}>
        <div>
          <h3 className="gv-type-h3">3 Keys to the Game</h3>
          <ol>
            {game.keys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="gv-type-h3">Swing Players</h3>
          {game.swing.map((s) => (
            <div key={s.name}>
              <strong>{s.name}</strong>
              <p>{s.role}</p>
            </div>
          ))}
        </div>
        <div>
          <h3 className="gv-type-h3">Film Notes</h3>
          <p>{game.film}</p>
          {game.filmLessonId ? (
            <p style={{ marginTop: '0.75rem' }}>
              <a
                href={`/vault/film-room/?lesson=${encodeURIComponent(game.filmLessonId)}`}
                className="gv-film-lesson__link"
              >
                Open Film Room opponent prep →
              </a>
            </p>
          ) : null}
        </div>
      </GridLayout>
      <div className="gv-game-card__pred">
        <p className="gv-type-label">GatorVault Prediction</p>
        <p className="gv-type-number" style={{ fontSize: '1.5rem', color: 'var(--gv-orange)' }}>
          {game.pred}
        </p>
      </div>
    </Card>
  );
}

const GAME_WEEK_PAYWALL = {
  message:
    'Game Week unlocks matchup intel, opponent film prep, swing-player notes, and GatorVault predictions.',
  ctaLabel: 'Unlock Game Week + Film Room',
} as const;

function GameWeekTabPanel({
  tab,
  game,
}: {
  tab: string;
  game: ScheduleGame;
}): React.ReactElement {
  if (tab === 'intel') {
    return (
      <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
        <GameCard game={game} />
      </InsiderPaywall>
    );
  }
  if (tab === 'depth') {
    return (
      <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
        <PageSection title="Projected Depth Chart">
          <Card>
            <p>Orange = projected starter · Blue = backup</p>
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
    );
  }
  if (tab === 'scout') {
    return (
      <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
        <PageSection title="Scouting Report">
          <Card>
            <p>{game.film}</p>
            {game.filmLessonId ? (
              <p style={{ marginTop: '1rem' }}>
                <Button href={`/vault/film-room/?lesson=${encodeURIComponent(game.filmLessonId)}`}>
                  Film Room breakdown
                </Button>
              </p>
            ) : null}
          </Card>
        </PageSection>
      </InsiderPaywall>
    );
  }
  return (
    <InsiderPaywall variant="overlay" {...GAME_WEEK_PAYWALL}>
      <PageSection title="Prediction Panel">
        <Card variant="accent">
          <p className="gv-type-number" style={{ fontSize: '2rem', color: 'var(--gv-orange)' }}>
            {game.pred}
          </p>
          <p>UF win probability: {game.ufPct}%</p>
          <Button href={SITE_ROUTES.gameZone}>Open Game Zone</Button>
        </Card>
      </PageSection>
    </InsiderPaywall>
  );
}

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
  const game = SCHEDULE_GAMES.find((g) => g.id === gameId) ?? SCHEDULE_GAMES[0];
  const days = useMemo(() => daysUntilKickoff(game.date), [game.date]);

  return (
    <PageLayout
      theme="blue"
      testId="vault-game-week"
      hero={
        <header className="gv-gw-hero">
          <div className="gv-page-layout__hero-inner">
            <div>
              <h1 className="gv-page-layout__title gv-type-h1">Game Week</h1>
              <p className="gv-page-layout__subtitle">Matchup spotlight, intel, and predictions.</p>
            </div>
            <Countdown days={days} />
          </div>
          <MatchupHero game={game} />
        </header>
      }
    >
      <div className="gv-game-pills">
        {SCHEDULE_GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`gv-game-pill${gameId === g.id ? ' is-active' : ''}`}
            onClick={() => setGameId(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <TabBar options={TABS} active={tab} onChange={setTab} aria-label="Game week sections" />

      <GameWeekTabPanel tab={tab} game={game} />

      {!insider ? (
        <a href="/join?tier=film" className="gv-paywall-sticky-cta">
          Unlock Game Week + Film Room · from $9.99/mo
        </a>
      ) : null}
    </PageLayout>
  );
}

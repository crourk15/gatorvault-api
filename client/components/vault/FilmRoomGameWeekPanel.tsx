'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Chip, GridLayout, PageSection } from '@/components/brand';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { SITE_ROUTES } from '@/lib/site-routes';

function daysUntilKickoff(dateStr: string): number {
  const match = dateStr.match(/(\w+) (\d+), (\d{4})/);
  if (!match) return 0;
  const kick = new Date(`${match[1]} ${match[2]}, ${match[3]}`);
  return Math.max(0, Math.ceil((kick.getTime() - Date.now()) / 86400000));
}

function Countdown({ days }: { days: number }): React.ReactElement {
  return (
    <div className="gv-fr-gw-countdown" data-testid="film-room-game-week-countdown">
      <span className="gv-fr-gw-countdown__num">{days}</span>
      <span className="gv-fr-gw-countdown__label">Days to kickoff</span>
    </div>
  );
}

function MatchupHero({ game }: { game: ScheduleGame }): React.ReactElement {
  return (
    <div className="gv-fr-gw-matchup">
      <div className="gv-fr-gw-matchup__logo gv-fr-gw-matchup__logo--uf" aria-hidden="true">
        🐊
      </div>
      <div className="gv-fr-gw-matchup__center">
        <Chip variant="orange">{game.tv ?? 'TBD'}</Chip>
        <h2 className="gv-fr-gw-matchup__title">Florida vs {game.opp}</h2>
        <p className="gv-fr-gw-matchup__meta">{game.date}</p>
        <p className="gv-fr-gw-matchup__venue">{game.venue}</p>
      </div>
      <div className="gv-fr-gw-matchup__logo gv-fr-gw-matchup__logo--opp" aria-hidden="true">
        {game.opp.slice(0, 2).toUpperCase()}
      </div>
    </div>
  );
}

function WinProbabilityBar({ ufPct }: { ufPct: number }): React.ReactElement {
  const oppPct = 100 - ufPct;
  return (
    <div className="gv-fr-gw-wp">
      <div className="gv-fr-gw-wp__uf" style={{ width: `${ufPct}%` }}>
        UF {ufPct}%
      </div>
      <div className="gv-fr-gw-wp__opp" style={{ width: `${oppPct}%` }}>
        {oppPct}%
      </div>
    </div>
  );
}

type Props = {
  compact?: boolean;
  initialGameId?: string;
};

export function FilmRoomGameWeekPanel({ compact = false, initialGameId }: Props): React.ReactElement {
  const [gameId, setGameId] = useState(initialGameId || 'fau');

  useEffect(() => {
    if (initialGameId) setGameId(initialGameId);
  }, [initialGameId]);
  const game = SCHEDULE_GAMES.find((g) => g.id === gameId) ?? SCHEDULE_GAMES[0];
  const days = useMemo(() => daysUntilKickoff(game.date), [game.date]);

  return (
    <div className={`gv-fr-game-week${compact ? ' gv-fr-game-week--compact' : ''}`} data-testid="film-room-game-week-panel">
      <div className="gv-fr-gw-hero-bar">
        {!compact ? (
          <div className="gv-fr-gw-hero-copy">
            <p className="gv-fr-gw-hero-kicker">Game Week</p>
            <h2 className="gv-fr-gw-hero-title">Matchup intel · keys · film prep</h2>
          </div>
        ) : null}
        <Countdown days={days} />
      </div>

      <MatchupHero game={game} />

      <div className="gv-fr-gw-pills">
        {SCHEDULE_GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`gv-fr-gw-pill${gameId === g.id ? ' is-active' : ''}`}
            onClick={() => setGameId(g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      <PageSection title="Win probability" subtitle="FutureCast Game Week model">
        <WinProbabilityBar ufPct={game.ufPct} />
      </PageSection>

      <GridLayout cols={compact ? 1 : 3}>
        <Card variant="dark" className="gv-fr-gw-card">
          <h3 className="gv-fr-gw-card__title">3 Keys to the Game</h3>
          <ol className="gv-fr-gw-list">
            {game.keys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ol>
        </Card>
        <Card variant="dark" className="gv-fr-gw-card">
          <h3 className="gv-fr-gw-card__title">Swing Players</h3>
          {game.swing.map((s) => (
            <div key={s.name} className="gv-fr-gw-swing">
              <strong>{s.name}</strong>
              <p>{s.role}</p>
            </div>
          ))}
        </Card>
        <Card variant="dark" className="gv-fr-gw-card">
          <h3 className="gv-fr-gw-card__title">Film Notes</h3>
          <p className="gv-fr-gw-card__body">{game.film}</p>
          {game.filmLessonId ? (
            <a
              href={`/vault/film-room/?hub=Game%20Week&lesson=${encodeURIComponent(game.filmLessonId)}`}
              className="gv-fr-btn gv-fr-btn--ghost"
            >
              Opponent prep lesson →
            </a>
          ) : null}
        </Card>
      </GridLayout>

      {game.opponentTendencies?.length ? (
        <PageSection title="Opponent tendencies" subtitle="Scouting profile">
          <Card variant="dark" className="gv-fr-gw-card">
            <ul className="gv-fr-gw-list gv-fr-gw-list--bullets">
              {game.opponentTendencies.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
        </PageSection>
      ) : null}

      {game.howUFWins?.length ? (
        <PageSection title="How UF wins" subtitle="Staff-aligned game plan">
          <Card variant="dark" className="gv-fr-gw-card">
            <ul className="gv-fr-gw-list gv-fr-gw-list--bullets">
              {game.howUFWins.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
        </PageSection>
      ) : null}

      <GridLayout cols={compact ? 1 : 2}>
        <PageSection title="Scouting report">
          <Card variant="dark" className="gv-fr-gw-card">
            <p className="gv-fr-gw-card__body">{game.scoutingReport || game.film}</p>
          </Card>
        </PageSection>
        <PageSection title="Prediction panel">
          <Card variant="dark" className="gv-fr-gw-card gv-fr-gw-card--accent">
            <p className="gv-fr-gw-pred-label">GatorVault prediction</p>
            <p className="gv-fr-gw-pred-score">{game.pred}</p>
            <p className="gv-fr-gw-pred-meta">UF win probability: {game.ufPct}%</p>
            <Button href={SITE_ROUTES.gameZone}>Open Game Zone</Button>
          </Card>
        </PageSection>
      </GridLayout>

      {!compact ? (
        <div className="gv-fr-gw-footer">
          <a href="/vault/game-week" className="gv-fr-btn">
            Full Game Week page →
          </a>
        </div>
      ) : null}
    </div>
  );
}

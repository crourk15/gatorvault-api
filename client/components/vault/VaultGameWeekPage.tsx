'use client';

import React, { useState } from 'react';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';

function GameCard({ game }: { game: ScheduleGame }): React.ReactElement {
  const oppPct = 100 - game.ufPct;
  return (
    <article className="gv-game-card">
      <h2 className="gv-game-card__title">🐊 Florida Gators vs {game.opp}</h2>
      <p className="gv-game-card__meta">
        {game.date} · {game.venue}
      </p>
      {game.tv ? <p className="gv-game-card__tv">📺 {game.tv}</p> : null}

      <div className="gv-game-card__wp">
        <p className="gv-game-card__wp-label">Win Probability</p>
        <div className="gv-wp-bar">
          <div className="gv-wp-bar__uf" style={{ width: `${game.ufPct}%` }}>
            UF {game.ufPct}%
          </div>
          <div className="gv-wp-bar__opp" style={{ width: `${oppPct}%` }}>
            {oppPct}%
          </div>
        </div>
      </div>

      <div className="gv-game-card__cols">
        <div className="gv-game-card__col">
          <h3>3 Keys to the Game</h3>
          <ol>
            {game.keys.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ol>
        </div>
        <div className="gv-game-card__col">
          <h3>Swing Players</h3>
          {game.swing.map((s) => (
            <div key={s.name}>
              <strong>{s.name}</strong>
              <p>{s.role}</p>
            </div>
          ))}
        </div>
        <div className="gv-game-card__col">
          <h3>Film Notes</h3>
          <p>{game.film}</p>
        </div>
      </div>

      <div className="gv-game-card__pred">
        <p className="gv-game-card__pred-label">GatorVault Prediction</p>
        <p className="gv-game-card__pred-value">{game.pred}</p>
      </div>
    </article>
  );
}

export function VaultGameWeekPage(): React.ReactElement {
  const [gameId, setGameId] = useState('fau');
  const game = SCHEDULE_GAMES.find((g) => g.id === gameId) ?? SCHEDULE_GAMES[0];

  return (
    <div className="gv-game-week" data-testid="vault-game-week">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Game Week</h1>
        <p className="gv-page-subtitle">2026 schedule — matchups, win probability, and film notes.</p>
      </div>

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

      <GameCard game={game} />
    </div>
  );
}

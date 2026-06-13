'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const SEASON_STATS = [
  { label: 'Pass YPG', hint: 'Season opens Sep 5' },
  { label: 'Rush YPG', hint: 'Season opens Sep 5' },
  { label: 'PPG', hint: 'Season opens Sep 5' },
  { label: 'PPG Allowed', hint: 'Season opens Sep 5' },
];

function gameTeams(g: BettingGame): { home: string; away: string } {
  return {
    home: g.homeTeam || g.home || 'Home',
    away: g.awayTeam || g.away || 'Away',
  };
}

function isLive(g: BettingGame): boolean {
  const s = (g.status || '').toLowerCase();
  return s.includes('live') || s.includes('in progress') || s.includes('halftime');
}

function formatScore(g: BettingGame): string {
  const h = g.homeScore != null ? g.homeScore : '-';
  const a = g.awayScore != null ? g.awayScore : '-';
  return `${h} - ${a}`;
}

export function VaultLiveScoresPage(): React.ReactElement {
  const [games, setGames] = useState<BettingGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLive, setHasLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBettingLines();
      const schedule = data.schedule ?? [];
      const list = data.nextGame ? [data.nextGame, ...schedule] : schedule;
      const deduped = list.filter(
        (g, i, arr) => arr.findIndex((x) => (x.id || x.game) === (g.id || g.game)) === i
      );
      setGames(deduped);
      setHasLive(deduped.some(isLive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load scores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="gv-live-scores" data-testid="vault-live-scores">
      <div className="gv-page-hero gv-live-scores__hero">
        <h1 className="gv-page-title">📊 Live Scores</h1>
        {hasLive ? (
          <span className="gv-live-scores__badge">
            <span className="gv-live-scores__dot" aria-hidden="true" />
            LIVE
          </span>
        ) : null}
      </div>
      <p className="gv-live-scores__hint">Live updates every 60 seconds during game windows</p>

      {loading && games.length === 0 && <p className="gv-page-status">Loading scores…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!error && (
        <div className="gv-live-scores__list">
          {games.map((g, i) => {
            const { home, away } = gameTeams(g);
            const live = isLive(g);
            return (
              <article
                key={g.id || g.game || i}
                className={`gv-live-scores__card${live ? ' is-live' : ''}`}
              >
                <div>
                  <p className="gv-live-scores__league">{g.game || 'GAME'}</p>
                  <p className="gv-live-scores__matchup">
                    {home} <span>vs</span> {away}
                  </p>
                  <p className="gv-live-scores__time">{g.kickoff || g.date || g.status || 'Scheduled'}</p>
                </div>
                <div className="gv-live-scores__score-block">
                  <p className="gv-live-scores__score">{formatScore(g)}</p>
                  <p className="gv-live-scores__status">{g.status || (live ? 'Live' : 'Scheduled')}</p>
                </div>
              </article>
            );
          })}
          {!loading && games.length === 0 && (
            <UiEmpty message="No live games right now." hint="Check back on gameday." />
          )}
        </div>
      )}

      <section className="gv-live-scores__season">
        <h2 className="gv-vault-alerts__section-title">2026 Season Stats</h2>
        <div className="gv-live-scores__stats">
          {SEASON_STATS.map((s) => (
            <div key={s.label} className="gv-recruit-stat">
              <span>{s.label}</span>
              <strong>—</strong>
              <p className="gv-live-scores__stat-hint">{s.hint}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

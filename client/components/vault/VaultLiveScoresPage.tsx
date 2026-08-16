'use client';

/**
 * Gators Live — Florida football game-day scoreboard.
 * Route stays /vault/live-scores/ for stability; product name is Gators Live.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chip, PageLayout, PageSection } from '@/components/brand';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import {
  gatorsLiveMode,
  getFeaturedUfGame,
  isUfGameLiveWindow,
  parseScheduleKickoff,
} from '@/lib/gators-live';
import type { ScheduleGame } from '@/lib/schedule-data';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const POLL_MS = 60_000;

function gameTeams(g: BettingGame): { home: string; away: string } {
  const oppExtra = (g as BettingGame & { opponent?: string }).opponent;
  return {
    home: g.homeTeam || g.home || g.game?.split(/\s+vs\.?\s+/i)?.[0] || 'Florida',
    away: g.awayTeam || g.away || oppExtra || g.game?.split(/\s+vs\.?\s+/i)?.[1] || 'Opponent',
  };
}

function isLiveStatus(g: BettingGame): boolean {
  const s = (g.status || '').toLowerCase();
  return s.includes('live') || s.includes('in progress') || s.includes('halftime');
}

function isUfBettingGame(g: BettingGame): boolean {
  const blob = [
    g.homeTeam,
    g.awayTeam,
    g.home,
    g.away,
    g.game,
    (g as { opponent?: string }).opponent,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\bflorida\b|\bgators\b|\buf\b/.test(blob);
}

function formatScore(g: BettingGame): string {
  const h = g.homeScore != null ? g.homeScore : '—';
  const a = g.awayScore != null ? g.awayScore : '—';
  return `${h} – ${a}`;
}

function pickUfGame(games: BettingGame[]): BettingGame | null {
  return games.find(isUfBettingGame) || games[0] || null;
}

function ReadyCard({ game }: { game: ScheduleGame }): React.ReactElement {
  const kick = parseScheduleKickoff(game.date);
  return (
    <article className="gv-gators-live__ready" data-testid="gators-live-ready">
      <p className="gv-gators-live__ready-eyebrow">Season ready</p>
      <h2 className="gv-gators-live__ready-title">Gators Live activates on game day</h2>
      <p className="gv-gators-live__ready-dek">
        Florida football only — score, status, and clock when the Gators are on the field. No
        national board noise.
      </p>
      <div className="gv-gators-live__next">
        <Chip variant="orange">Next up</Chip>
        <p className="gv-gators-live__next-matchup">Florida vs {game.opp}</p>
        <p className="gv-gators-live__next-meta">{game.date}</p>
        <p className="gv-gators-live__next-meta">
          {game.venue}
          {game.tv ? ` · ${game.tv}` : ''}
        </p>
        {kick ? (
          <p className="gv-gators-live__next-hint">
            Scoreboard goes live about 3 hours before kickoff and stays up through the final.
          </p>
        ) : null}
      </div>
      <div className="gv-gators-live__links">
        <a href={`/vault/game-week/?game=${encodeURIComponent(game.id)}`} className="rh-cc-link">
          Open Game Week →
        </a>
        <a href="/vault/schedule/" className="rh-cc-link">
          Full schedule →
        </a>
      </div>
    </article>
  );
}

function LiveBoard({
  game,
  scheduleGame,
  live,
}: {
  game: BettingGame;
  scheduleGame: ScheduleGame | null;
  live: boolean;
}): React.ReactElement {
  const { home, away } = gameTeams(game);
  const opp = scheduleGame?.opp || away;
  return (
    <article
      className={`gv-gators-live__board${live ? ' is-live' : ''}`}
      data-testid="gators-live-board"
    >
      <div className="gv-gators-live__board-head">
        {live ? (
          <span className="gv-live-scores__badge">
            <span className="gv-live-scores__dot" aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <Chip variant="blue">Game window</Chip>
        )}
        <p className="gv-gators-live__board-label">Florida Gators</p>
      </div>
      <p className="gv-gators-live__board-matchup">
        {home.includes('Florida') || home === 'UF' ? 'Florida' : home}{' '}
        <span>vs</span> {opp}
      </p>
      <p className={`gv-gators-live__board-score${live ? ' is-live' : ''}`}>{formatScore(game)}</p>
      <p className="gv-gators-live__board-status">
        {game.status || (live ? 'In progress' : scheduleGame?.date || game.kickoff || game.date || 'Scheduled')}
      </p>
      <p className="gv-gators-live__board-meta">
        Updates every 60 seconds during the UF game window. Odds/schedule feed until full live
        score wiring lands for kickoff.
      </p>
      {scheduleGame ? (
        <div className="gv-gators-live__links">
          <a
            href={`/vault/game-week/?game=${encodeURIComponent(scheduleGame.id)}`}
            className="rh-cc-link"
          >
            Game Week intel →
          </a>
        </div>
      ) : null}
    </article>
  );
}

export function VaultLiveScoresPage(): React.ReactElement {
  const [mode, setMode] = useState<'live-window' | 'ready'>(() => gatorsLiveMode());
  const featured = useMemo(() => getFeaturedUfGame(), [mode]);
  const [ufLine, setUfLine] = useState<BettingGame | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLive, setHasLive] = useState(false);

  const loadLive = useCallback(async () => {
    if (!isUfGameLiveWindow()) {
      setMode('ready');
      setUfLine(null);
      setHasLive(false);
      setLoading(false);
      return;
    }
    setMode('live-window');
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBettingLines();
      const schedule = data.schedule ?? [];
      const list = data.nextGame ? [data.nextGame, ...schedule] : schedule;
      const uf = pickUfGame(list);
      setUfLine(uf);
      setHasLive(Boolean(uf && isLiveStatus(uf)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Gators Live.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshMode = () => setMode(gatorsLiveMode());
    refreshMode();

    if (!isUfGameLiveWindow()) {
      // Offseason / midweek — no provider calls.
      return;
    }

    void loadLive();
    const id = window.setInterval(() => void loadLive(), POLL_MS);
    const modeId = window.setInterval(refreshMode, POLL_MS);
    return () => {
      window.clearInterval(id);
      window.clearInterval(modeId);
    };
  }, [loadLive]);

  // If we leave the window while mounted, stop showing stale poll state.
  useEffect(() => {
    if (mode === 'ready') {
      setUfLine(null);
      setHasLive(false);
      setError(null);
    }
  }, [mode]);

  return (
    <PageLayout
      theme="navy"
      title="Gators Live"
      subtitle={
        mode === 'live-window'
          ? 'Florida football — live updates every 60 seconds in the game window'
          : 'Florida football game-day scoreboard — ready for the 2026 season'
      }
      testId="vault-live-scores"
      className="gv-gators-live-page"
      accent={
        hasLive ? (
          <span className="gv-live-scores__badge">
            <span className="gv-live-scores__dot" aria-hidden="true" />
            LIVE
          </span>
        ) : null
      }
    >
      {mode === 'ready' && featured ? <ReadyCard game={featured} /> : null}

      {mode === 'live-window' ? (
        <>
          {loading && !ufLine ? <p className="gv-page-status">Loading Gators Live…</p> : null}
          {error && !loading ? (
            <UiError message={error} retry={() => void loadLive()} backHref="/vault" backLabel="← Vault" />
          ) : null}
          {!error && ufLine ? (
            <PageSection title="Florida game">
              <LiveBoard game={ufLine} scheduleGame={featured} live={hasLive} />
            </PageSection>
          ) : null}
          {!error && !loading && !ufLine ? (
            <UiEmpty
              message="Waiting on Florida game data."
              hint="Game window is open — check back in a minute, or open Game Week."
            />
          ) : null}
        </>
      ) : null}
    </PageLayout>
  );
}

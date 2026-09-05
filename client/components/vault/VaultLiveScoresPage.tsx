'use client';

/**
 * Gators Live — Florida football game-day scoreboard.
 * Route stays /vault/live-scores/ for stability; product name is Gators Live.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Chip, PageLayout, PageSection } from '@/components/brand';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import { fetchGatorsLive } from '@/lib/gators-live-api';
import {
  gatorsLiveMode,
  getFeaturedUfGame,
  isUfGameLiveWindow,
  parseScheduleKickoff,
} from '@/lib/gators-live';
import type { ScheduleGame } from '@/lib/schedule-data';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const POLL_MS = 30_000;

type BoardModel = {
  opponent: string;
  ufScore: number | null;
  oppScore: number | null;
  status: string;
  live: boolean;
};

function isLiveStatus(status: string, liveFlag?: boolean): boolean {
  if (liveFlag === true) return true;
  const s = (status || '').toLowerCase();
  return s.includes('live') || s.includes('in progress') || s.includes('halftime');
}

function isUfBettingGame(g: BettingGame): boolean {
  const blob = [g.homeTeam, g.awayTeam, g.home, g.away, g.game, g.opponent]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return /\bflorida\b|\bgators\b|\buf\b/.test(blob);
}

function pickUfGame(games: BettingGame[]): BettingGame | null {
  return games.find(isUfBettingGame) || games[0] || null;
}

function boardFromBetting(g: BettingGame, scheduleGame: ScheduleGame | null): BoardModel {
  const opp = scheduleGame?.opp || g.opponent || g.awayTeam || g.away || 'Opponent';
  const status = String(g.status || scheduleGame?.date || g.kickoff || g.date || 'Scheduled');
  return {
    opponent: opp,
    ufScore: g.homeScore != null ? Number(g.homeScore) : null,
    oppScore: g.awayScore != null ? Number(g.awayScore) : null,
    status,
    live: isLiveStatus(status, g.live),
  };
}

function scoreText(n: number | null): string {
  return n == null || Number.isNaN(n) ? '—' : String(n);
}

function ReadyCard({ game }: { game: ScheduleGame }): React.ReactElement {
  const kick = parseScheduleKickoff(game.date);
  return (
    <article className="gv-gators-live__ready" data-testid="gators-live-ready">
      <p className="gv-gators-live__ready-eyebrow">Season ready</p>
      <h2 className="gv-gators-live__ready-title">Gators Live activates on game day</h2>
      <p className="gv-gators-live__ready-dek">
        Florida football only — score, quarter, and clock when the Gators are on the field. No
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
  board,
  scheduleGame,
}: {
  board: BoardModel;
  scheduleGame: ScheduleGame | null;
}): React.ReactElement {
  return (
    <article
      className={`gv-gators-live__board${board.live ? ' is-live' : ''}`}
      data-testid="gators-live-board"
    >
      <div className="gv-gators-live__board-head">
        {board.live ? (
          <span className="gv-live-scores__badge">
            <span className="gv-live-scores__dot" aria-hidden="true" />
            LIVE
          </span>
        ) : (
          <Chip variant="blue">{/final/i.test(board.status) ? 'Final' : 'Game window'}</Chip>
        )}
        <p className="gv-gators-live__board-label">Florida Gators</p>
      </div>
      <p className="gv-gators-live__board-matchup">
        Florida <span>vs</span> {board.opponent}
      </p>
      <div className="gv-gators-live__scoreline" data-testid="gators-live-scoreline">
        <div className="gv-gators-live__score-row">
          <span>Florida</span>
          <strong className={board.live ? 'is-live' : undefined}>{scoreText(board.ufScore)}</strong>
        </div>
        <div className="gv-gators-live__score-row">
          <span>{board.opponent}</span>
          <strong>{scoreText(board.oppScore)}</strong>
        </div>
      </div>
      <p className="gv-gators-live__board-status">{board.status}</p>
      <p className="gv-gators-live__board-meta">Updates every 30 seconds while the Gators are on.</p>
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
  const [board, setBoard] = useState<BoardModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    if (!isUfGameLiveWindow()) {
      setMode('ready');
      setBoard(null);
      setLoading(false);
      return;
    }
    setMode('live-window');
    setLoading(true);
    setError(null);
    try {
      try {
        const live = await fetchGatorsLive();
        if (live.mode === 'ready' && !live.inWindow) {
          setMode('ready');
          setBoard(null);
          return;
        }
        if (live.board) {
          const status = String(live.board.status || live.board.detail || 'Scheduled');
          setBoard({
            opponent: live.board.opponent || featured?.opp || 'Opponent',
            ufScore: live.board.ufScore ?? null,
            oppScore: live.board.oppScore ?? null,
            status,
            live: Boolean(live.board.live) || isLiveStatus(status),
          });
          return;
        }
      } catch {
        /* fall through to betting overlay */
      }

      const data = await fetchBettingLines();
      const schedule = data.schedule ?? [];
      const list = data.nextGame ? [data.nextGame, ...schedule] : schedule;
      const uf = pickUfGame(list);
      if (!uf) {
        setBoard(null);
        return;
      }
      setBoard(boardFromBetting(uf, featured));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Gators Live.');
    } finally {
      setLoading(false);
    }
  }, [featured]);

  useEffect(() => {
    const refreshMode = () => setMode(gatorsLiveMode());
    refreshMode();

    if (!isUfGameLiveWindow()) {
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

  useEffect(() => {
    if (mode === 'ready') {
      setBoard(null);
      setError(null);
    }
  }, [mode]);

  const hasLive = Boolean(board?.live);

  return (
    <PageLayout
      theme="navy"
      title="Gators Live"
      subtitle={
        mode === 'live-window'
          ? 'Florida football — score and clock in the game window'
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
          {loading && !board ? <p className="gv-page-status">Loading Gators Live…</p> : null}
          {error && !loading ? (
            <UiError message={error} retry={() => void loadLive()} backHref="/vault" backLabel="← Vault" />
          ) : null}
          {!error && board ? (
            <PageSection title="Florida game">
              <LiveBoard board={board} scheduleGame={featured} />
            </PageSection>
          ) : null}
          {!error && !loading && !board ? (
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

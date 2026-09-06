'use client';

/**
 * Gators Live — Florida football living room.
 * Route stays /vault/live-scores/; score is the heartbeat, not the product.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageLayout } from '@/components/brand';
import { fetchBettingLines } from '@/lib/betting-api';
import { fetchCommunityThreads, type CommunityThread } from '@/lib/community-api';
import {
  bettingLineForScheduleGame,
  getGameWeekBundle,
  type GameWeekBettingLine,
  type GameWeekBundle,
} from '@/lib/game-week-data';
import { fetchGatorsLive } from '@/lib/gators-live-api';
import {
  findLastCompletedUfGame,
  gatorsLiveMode,
  gatorsLivePhase,
  gatorsLiveVoice,
  getFeaturedUfGame,
  isUfGameLiveWindow,
  kickCountdown,
  parseScheduleKickoff,
  periodClockLabel,
  pickCommunityTalkThread,
  possessionSide,
  readLocalPreviewPhase,
  type GatorsLivePhase,
} from '@/lib/gators-live';
import { fetchScheduleGames } from '@/lib/schedule-api';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { homeLogoUrl, awayLogoUrl } from '@/lib/team-logos';
import { playerProfilePath } from '@/lib/player-routes';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import { UiError } from '@/components/site/UiMessage';
import '@/lib/gators-live-elite.css';

const POLL_MS = 30_000;

type BoardModel = {
  opponent: string;
  ufScore: number | null;
  oppScore: number | null;
  status: string;
  clock: string | null;
  period: number | null;
  possession: string | null;
  live: boolean;
  completed: boolean;
};

function isLiveStatus(status: string, liveFlag?: boolean): boolean {
  if (liveFlag === true) return true;
  const s = (status || '').toLowerCase();
  return s.includes('live') || s.includes('in progress') || s.includes('halftime');
}

function scoreText(n: number | null): string {
  return n == null || Number.isNaN(n) ? '—' : String(n);
}

function phaseChip(phase: GatorsLivePhase): string {
  if (phase === 'live') return 'Live';
  if (phase === 'halftime') return 'Halftime';
  if (phase === 'final') return 'Final';
  if (phase === 'pregame') return 'Game day';
  return 'Next up';
}

function previewBoard(phase: GatorsLivePhase, game: ScheduleGame | null): BoardModel {
  const opp = game?.opp || 'FAU Owls';
  if (phase === 'final') {
    return {
      opponent: opp,
      ufScore: 38,
      oppScore: 10,
      status: 'Final',
      clock: null,
      period: 4,
      possession: null,
      live: false,
      completed: true,
    };
  }
  if (phase === 'pregame') {
    return {
      opponent: opp,
      ufScore: null,
      oppScore: null,
      status: game?.date || 'Scheduled',
      clock: null,
      period: null,
      possession: null,
      live: false,
      completed: false,
    };
  }
  return {
    opponent: opp,
    ufScore: 21,
    oppScore: 7,
    status: '2nd quarter · 8:32',
    clock: '8:32',
    period: 2,
    possession: '57',
    live: true,
    completed: false,
  };
}

function formatCountdown(parts: { days: number; hours: number; minutes: number }): Array<{
  n: number;
  label: string;
}> {
  return [
    { n: parts.days, label: 'Days' },
    { n: parts.hours, label: 'Hrs' },
    { n: parts.minutes, label: 'Min' },
  ];
}

function GatorsLiveHero({
  phase,
  game,
  board,
  line,
}: {
  phase: GatorsLivePhase;
  game: ScheduleGame | null;
  board: BoardModel | null;
  line: GameWeekBettingLine | null;
}): React.ReactElement {
  const opp = board?.opponent || game?.opp || 'Opponent';
  const showScores = phase === 'live' || phase === 'halftime' || phase === 'final';
  const clock = periodClockLabel({
    phase,
    period: board?.period,
    clock: board?.clock,
    status: board?.status,
  });
  const ball = possessionSide(board?.possession);
  const count = game && (phase === 'ready' || phase === 'pregame') ? kickCountdown(game.date) : null;
  const kick = game ? parseScheduleKickoff(game.date) : null;
  const kickLabel = kick
    ? kick.toLocaleString('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }) + ' ET'
    : game?.date || '';

  return (
    <section
      className={`gv-gl-elite__hero${phase === 'live' ? ' is-live' : ''}`}
      aria-label="Gators Live"
      data-testid="gators-live-hero"
    >
      <span className="gv-gl-elite__hero-watermark" aria-hidden="true">
        SWAMP
      </span>
      <div className="gv-gl-elite__hero-inner">
        <div className="gv-gl-elite__eyebrow">
          <p className="gv-gl-elite__brand">Gators Live</p>
          <span className={`gv-gl-elite__phase${phase === 'live' ? ' is-live' : ''}`}>
            {phase === 'live' ? <span className="gv-gl-elite__dot" aria-hidden="true" /> : null}
            {phaseChip(phase)}
          </span>
        </div>
        {game ? (
          <div className="gv-gl-elite__matchup-logos">
            <img src={homeLogoUrl()} alt="Florida Gators" className="gv-gl-elite__logo" width={56} height={56} />
            <span className="gv-gl-elite__vs" aria-hidden="true">
              vs
            </span>
            <img src={awayLogoUrl(game.id)} alt={opp} className="gv-gl-elite__logo" width={56} height={56} />
          </div>
        ) : null}
        <h1 className="gv-gl-elite__title">Florida vs {opp}</h1>
        <p className="gv-gl-elite__voice">{gatorsLiveVoice(phase, opp)}</p>
        {showScores ? (
          <div className="gv-gl-elite__scoreboard" data-testid="gators-live-scoreline">
            <div className={`gv-gl-elite__score-col is-uf${phase === 'live' ? ' is-live' : ''}`}>
              <span className="gv-gl-elite__score-name">Florida</span>
              <strong className="gv-gl-elite__score-num">{scoreText(board?.ufScore ?? null)}</strong>
            </div>
            <span className="gv-gl-elite__score-mid">{phase === 'final' ? 'FIN' : 'VS'}</span>
            <div className="gv-gl-elite__score-col">
              <span className="gv-gl-elite__score-name">{opp}</span>
              <strong className="gv-gl-elite__score-num">{scoreText(board?.oppScore ?? null)}</strong>
            </div>
          </div>
        ) : null}
        <div className="gv-gl-elite__clock">
          <p className="gv-gl-elite__clock-main">{showScores ? clock : kickLabel}</p>
          {phase === 'live' && ball ? (
            <p className="gv-gl-elite__poss">{ball === 'uf' ? 'Florida ball' : `${opp} ball`}</p>
          ) : null}
        </div>
        {count ? (
          <div className="gv-gl-elite__countdown" data-testid="gators-live-countdown">
            {formatCountdown(count).map((cell) => (
              <div key={cell.label} className="gv-gl-elite__count-cell">
                <span className="gv-gl-elite__count-num">{cell.n}</span>
                <span className="gv-gl-elite__count-label">{cell.label}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="gv-gl-elite__meta">
          {[game?.venue, game?.tv].filter(Boolean).join(' · ')}
        </p>
        {line?.spreadLine || line?.total ? (
          <div className="gv-gl-elite__chips">
            {line.spreadLine ? <span className="gv-gl-elite__chip">{line.spreadLine}</span> : null}
            {line.total ? <span className="gv-gl-elite__chip">{String(line.total)}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="gv-gl-elite__hero-accent" aria-hidden="true" />
    </section>
  );
}

function TalkCard({ thread, phase }: { thread: CommunityThread | null; phase: GatorsLivePhase }): React.ReactElement {
  const href = thread ? `/vault/community/thread/${encodeURIComponent(thread.id)}/` : '/vault/community/';
  const gameday = Boolean(thread?.gameday || /game day talk/i.test(thread?.title || ''));
  const replies = thread?.replyCount ?? 0;
  return (
    <article className="gv-gl-elite__card" data-testid="gators-live-talk">
      <p className="gv-gl-elite__card-kicker">{gameday ? 'Game day talk' : 'The room'}</p>
      <h2 className="gv-gl-elite__card-title">
        {phase === 'final' ? 'After the whistle' : phase === 'live' || phase === 'halftime' ? 'Talk the game' : 'Talk now'}
      </h2>
      <p className="gv-gl-elite__card-dek">
        {phase === 'final'
          ? 'Final is in. Stay in the thread. What did you see?'
          : 'Now, during kickoff, and after. One thread.'}
      </p>
      {thread ? <p className="gv-gl-elite__talk-title">{thread.title}</p> : null}
      <p className="gv-gl-elite__talk-meta">
        {thread
          ? `${thread.authorDisplay || 'GatorVault Staff'} · ${
              replies === 0 ? 'No replies yet. Be first.' : `${replies} replies`
            }`
          : 'Open Community and jump in.'}
      </p>
      <div className="gv-gl-elite__doors" style={{ marginTop: '0.85rem' }}>
        <VaultNavLink href={href} className="gv-gl-elite__door">
          {thread ? 'Open the thread' : 'Open Community'}
          <span aria-hidden="true">→</span>
        </VaultNavLink>
      </div>
    </article>
  );
}

function WatchThis({ bundle }: { bundle: GameWeekBundle }): React.ReactElement | null {
  const keys = bundle.keys.slice(0, 3);
  if (!keys.length) return null;
  return (
    <article className="gv-gl-elite__card" data-testid="gators-live-keys">
      <p className="gv-gl-elite__card-kicker">Watch this</p>
      <h2 className="gv-gl-elite__card-title">3 keys</h2>
      <p className="gv-gl-elite__card-dek">Win these, Florida wins.</p>
      <div className="gv-gl-elite__keys">
        {keys.map((key, i) => (
          <div key={key.id} className="gv-gl-elite__key">
            <span className="gv-gl-elite__key-num">{i + 1}</span>
            <div>
              <p className="gv-gl-elite__key-title">{key.title}</p>
              {key.body ? <p className="gv-gl-elite__key-body">{key.body}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function VisitorsCard({ game }: { game: ScheduleGame }): React.ReactElement | null {
  const panel = game.expectedVisitors;
  const visitors = panel?.visitors || [];
  if (!visitors.length) return null;
  return (
    <article className="gv-gl-elite__card" data-testid="gators-live-visitors">
      <p className="gv-gl-elite__card-kicker">Who is here</p>
      <h2 className="gv-gl-elite__card-title">Expected visitors</h2>
      <p className="gv-gl-elite__card-dek">
        Early look{panel?.dateLabel ? ` · ${panel.dateLabel}` : ''}. Plans can change.
      </p>
      <ul className="gv-gl-elite__visitors">
        {visitors.map((v) => {
          const href = playerProfilePath(v.slug, 'HIGH_SCHOOL', true, v.name, 'recruiting');
          const meta = [v.position, v.classYear, v.school].filter(Boolean).join(' · ');
          return (
            <li key={v.slug} className="gv-gl-elite__visitor">
              <VaultNavLink href={href} className="gv-gl-elite__visitor-link">
                <span className="gv-gl-elite__visitor-mark">{(v.position || 'HS').slice(0, 3).toUpperCase()}</span>
                <span>
                  <span className="gv-gl-elite__visitor-name">{v.name}</span>
                  {meta ? <span className="gv-gl-elite__visitor-meta">{meta}</span> : null}
                </span>
                <span className="gv-gl-elite__chevron" aria-hidden="true">
                  →
                </span>
              </VaultNavLink>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function FilmBite({ notes }: { notes: string[] }): React.ReactElement | null {
  const bite = notes.find((n) => String(n || '').trim());
  if (!bite) return null;
  return (
    <article className="gv-gl-elite__card" data-testid="gators-live-film">
      <p className="gv-gl-elite__card-kicker">On tape</p>
      <h2 className="gv-gl-elite__card-title">Film bite</h2>
      <p className="gv-gl-elite__film">{bite}</p>
    </article>
  );
}

export function VaultLiveScoresPage(): React.ReactElement {
  const [mode, setMode] = useState<'live-window' | 'ready'>(() => gatorsLiveMode());
  const [preview, setPreview] = useState<GatorsLivePhase | null>(null);
  const featured = useMemo(() => getFeaturedUfGame(), [mode, preview]);
  const lastGame = useMemo(() => findLastCompletedUfGame(), [mode, preview]);
  const [games, setGames] = useState<ScheduleGame[]>(SCHEDULE_GAMES);
  const [board, setBoard] = useState<BoardModel | null>(null);
  const [line, setLine] = useState<GameWeekBettingLine | null>(null);
  const [talk, setTalk] = useState<CommunityThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLive = useCallback(async () => {
    const localPreview = readLocalPreviewPhase();
    if (localPreview) {
      setPreview(localPreview);
      setMode(localPreview === 'ready' ? 'ready' : 'live-window');
      setBoard(localPreview === 'ready' ? null : previewBoard(localPreview, featured));
      setLoading(false);
      setError(null);
      return;
    }
    setPreview(null);
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
            clock: live.board.clock ?? null,
            period: live.board.period ?? null,
            possession: live.board.possession ?? null,
            live: Boolean(live.board.live) || isLiveStatus(status),
            completed: Boolean(live.board.completed) || /\bfinal\b/i.test(status),
          });
          return;
        }
      } catch {
        /* fall through to betting overlay */
      }

      const data = await fetchBettingLines();
      const uf = data.nextGame || (data.schedule || []).find((g) =>
        /\bflorida\b|\bgators\b|\buf\b/i.test([g.homeTeam, g.awayTeam, g.home, g.away, g.game, g.opponent].filter(Boolean).join(' ')),
      );
      if (!uf) {
        setBoard(null);
        return;
      }
      const status = String(uf.status || featured?.date || uf.kickoff || uf.date || 'Scheduled');
      setBoard({
        opponent: featured?.opp || uf.opponent || uf.awayTeam || uf.away || 'Opponent',
        ufScore: uf.homeScore != null ? Number(uf.homeScore) : null,
        oppScore: uf.awayScore != null ? Number(uf.awayScore) : null,
        status,
        clock: uf.clock ?? null,
        period: uf.period ?? null,
        possession: null,
        live: isLiveStatus(status, uf.live),
        completed: Boolean(uf.completed) || /\bfinal\b/i.test(status),
      });
    } catch (err) {
      if (featured) {
        setBoard((prev) => prev || {
          opponent: featured.opp,
          ufScore: null,
          oppScore: null,
          status: featured.date,
          clock: null,
          period: null,
          possession: null,
          live: false,
          completed: false,
        });
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : 'Could not load Gators Live.');
      }
    } finally {
      setLoading(false);
    }
  }, [featured]);

  useEffect(() => {
    void loadLive();
    const id = window.setInterval(() => void loadLive(), POLL_MS);
    return () => window.clearInterval(id);
  }, [loadLive]);

  useEffect(() => {
    let cancelled = false;
    fetchScheduleGames(2026)
      .then((live) => {
        if (!cancelled && live.length) setGames(live);
      })
      .catch(() => {
        /* seed */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchBettingLines()
      .then((lines) => {
        if (cancelled || !featured) return;
        setLine(bettingLineForScheduleGame(featured, lines));
      })
      .catch(() => {
        /* leave empty */
      });
    return () => {
      cancelled = true;
    };
  }, [featured, games]);

  useEffect(() => {
    let cancelled = false;
    fetchCommunityThreads({ sort: 'activity', limit: 16 })
      .then((threads) => {
        if (!cancelled) setTalk(pickCommunityTalkThread(threads));
      })
      .catch(() => {
        /* talk card still opens Community */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const game =
    (featured && games.find((g) => g.id === featured.id)) ||
    featured ||
    games[0] ||
    null;
  const phase = preview || gatorsLivePhase({
    mode,
    live: board?.live,
    completed: board?.completed,
    status: board?.status,
  });
  const bundle = useMemo(
    () => (game ? getGameWeekBundle(game.id, games, line) : null),
    [game, games, line],
  );
  const showLast = phase === 'ready' && lastGame && lastGame.id !== game?.id;

  return (
    <div
      className="rh-page rh-page--elite gv-gl-elite mobile-app gv-page"
      data-testid="vault-gators-live-elite"
      data-loading={loading ? '1' : undefined}
    >
      <PageLayout theme="navy" title="" testId="vault-live-scores" className="gv-gators-live-page">
        <GatorsLiveHero phase={phase} game={game} board={board} line={line} />
        {error && !game ? (
          <UiError message={error} retry={() => void loadLive()} backHref="/vault" backLabel="← Vault" />
        ) : null}
        <div className="gv-gl-elite__stack">
          <TalkCard thread={talk} phase={phase} />
          {bundle ? <WatchThis bundle={bundle} /> : null}
          {game ? <VisitorsCard game={game} /> : null}
          {bundle ? <FilmBite notes={bundle.filmNotes} /> : null}
          {showLast ? (
            <article className="gv-gl-elite__card" data-testid="gators-live-last">
              <p className="gv-gl-elite__card-kicker">Last out</p>
              <h2 className="gv-gl-elite__card-title">Florida vs {lastGame.opp}</h2>
              <p className="gv-gl-elite__last">{lastGame.date}</p>
              <div className="gv-gl-elite__doors" style={{ marginTop: '0.75rem' }}>
                <VaultNavLink
                  href={`/vault/game-week/?game=${encodeURIComponent(lastGame.id)}`}
                  className="gv-gl-elite__door"
                >
                  Open last Game Week
                  <span aria-hidden="true">→</span>
                </VaultNavLink>
              </div>
            </article>
          ) : null}
          <article className="gv-gl-elite__card">
            <p className="gv-gl-elite__card-kicker">More</p>
            <h2 className="gv-gl-elite__card-title">Keep going</h2>
            <div className="gv-gl-elite__doors">
              {game ? (
                <VaultNavLink
                  href={`/vault/game-week/?game=${encodeURIComponent(game.id)}`}
                  className="gv-gl-elite__door"
                >
                  Full Game Week intel
                  <span aria-hidden="true">→</span>
                </VaultNavLink>
              ) : null}
              <VaultNavLink href="/vault/schedule/" className="gv-gl-elite__door">
                Full schedule
                <span aria-hidden="true">→</span>
              </VaultNavLink>
            </div>
          </article>
        </div>
      </PageLayout>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import { buildSeedNextGame } from '@/lib/game-zone-hub-seed';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { UiError } from '@/components/site/UiMessage';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import '@/lib/game-zone-ritual.css';

const PRED_PREFIX = 'gv_gz_ticket_';

type CoverLean = 'cover' | 'no-cover' | null;

type SavedTicket = {
  uf: string;
  opp: string;
  cover: CoverLean;
  lockedAt: string;
};

function opponentName(g?: BettingGame | null): string {
  if (!g) return 'Opponent';
  if (g.opponent?.trim()) return g.opponent.trim();
  const away = g.awayTeam || g.away || '';
  const home = g.homeTeam || g.home || '';
  if (/florida/i.test(away)) return home || 'Opponent';
  if (/florida/i.test(home)) return away || 'Opponent';
  return away || home || 'Opponent';
}

function gameKey(g?: BettingGame | null): string {
  return String(g?.id || g?.game || g?.date || g?.kickoff || 'next').replace(/\s+/g, '_');
}

function spreadLine(g?: BettingGame | null): string | null {
  if (!g?.spread) return null;
  if (typeof g.spread === 'string') return g.spread;
  return g.spread.line || null;
}

function spreadNumber(g?: BettingGame | null): number | null {
  if (!g?.spread) return null;
  if (typeof g.spread !== 'string' && typeof g.spread.uf === 'number') return g.spread.uf;
  const line = spreadLine(g) || '';
  const m = line.match(/([+-]?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function kickDate(g?: BettingGame | null): Date | null {
  const raw = g?.kickoff || g?.date;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatKickoff(g?: BettingGame | null): string {
  const d = kickDate(g);
  if (!d) return 'Kickoff TBA';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function countdownLabel(g?: BettingGame | null): string {
  const d = kickDate(g);
  if (!d) return 'Kickoff countdown TBA';
  const ms = d.getTime() - Date.now();
  if (ms <= 0) return 'Game window is open';
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 1) return `${days} days to kickoff`;
  if (days === 1) return `1 day, ${hours}h to kickoff`;
  if (hours >= 1) return `${hours} hours to kickoff`;
  const mins = Math.max(1, Math.floor(ms / 60000));
  return `${mins} minutes to kickoff`;
}

function matchSchedule(g?: BettingGame | null): ScheduleGame | null {
  if (!g) return SCHEDULE_GAMES[0] ?? null;
  const blob = `${g.opponent || ''} ${g.game || ''} ${g.id || ''}`.toLowerCase();
  return (
    SCHEDULE_GAMES.find((s) => {
      const opp = s.opp.toLowerCase();
      const id = s.id.toLowerCase();
      return blob.includes(id) || opp.split(/\s+/).some((w) => w.length > 2 && blob.includes(w));
    }) ?? SCHEDULE_GAMES[0] ?? null
  );
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

const SEED_NEXT_GAME = buildSeedNextGame();
const HAS_GAME_ZONE_SEED = Boolean(SEED_NEXT_GAME);

export function VaultGameZonePage(): React.ReactElement {
  const [nextGame, setNextGame] = useState<BettingGame | null>(SEED_NEXT_GAME);
  const [loading, setLoading] = useState(!HAS_GAME_ZONE_SEED);
  const [error, setError] = useState<string | null>(null);
  const [ufScore, setUfScore] = useState('31');
  const [oppScore, setOppScore] = useState('10');
  const [cover, setCover] = useState<CoverLean>(null);
  const [ticket, setTicket] = useState<SavedTicket | null>(null);
  const [justLocked, setJustLocked] = useState(false);

  const storageKey = useMemo(() => PRED_PREFIX + gameKey(nextGame), [nextGame]);
  const opp = opponentName(nextGame);
  const spread = spreadLine(nextGame);
  const total = nextGame?.total != null ? String(nextGame.total) : null;
  const venue = nextGame?.venue || matchSchedule(nextGame)?.venue || 'The Swamp';
  const schedule = matchSchedule(nextGame);
  const locked = Boolean(ticket);
  const keys = (schedule?.keys || []).slice(0, 3);
  const outlook = schedule?.pred || null;
  const film = schedule?.film || schedule?.scoutingReport || null;

  const load = useCallback(async () => {
    if (!HAS_GAME_ZONE_SEED) {
      setLoading(true);
      setError(null);
    }
    try {
      const data = await fetchBettingLines();
      if (data.nextGame) {
        setNextGame(data.nextGame);
        setError(null);
      } else if (!HAS_GAME_ZONE_SEED) {
        setNextGame(null);
      }
    } catch (err) {
      if (!HAS_GAME_ZONE_SEED) {
        setError(err instanceof Error ? err.message : 'Could not load the next game.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) {
        setTicket(null);
        return;
      }
      const saved = JSON.parse(raw) as SavedTicket;
      if (saved?.uf && saved?.opp) {
        setTicket(saved);
        setUfScore(saved.uf);
        setOppScore(saved.opp);
        setCover(saved.cover ?? null);
      }
    } catch {
      setTicket(null);
    }
  }, [storageKey]);

  const nudge = (side: 'uf' | 'opp', delta: number) => {
    if (locked) return;
    if (side === 'uf') setUfScore(String(clampScore((parseInt(ufScore, 10) || 0) + delta)));
    else setOppScore(String(clampScore((parseInt(oppScore, 10) || 0) + delta)));
  };

  const lockTicket = () => {
    if (!ufScore.trim() || !oppScore.trim() || !cover) return;
    const saved: SavedTicket = {
      uf: String(clampScore(parseInt(ufScore, 10))),
      opp: String(clampScore(parseInt(oppScore, 10))),
      cover,
      lockedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
    setTicket(saved);
    setJustLocked(true);
    window.setTimeout(() => setJustLocked(false), 1200);
  };

  const clearTicket = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setTicket(null);
    setJustLocked(false);
  };

  const spreadN = spreadNumber(nextGame);
  const margin = (parseInt(ufScore, 10) || 0) - (parseInt(oppScore, 10) || 0);
  const coverHint =
    spreadN == null || !cover
      ? null
      : cover === 'cover'
        ? `You’re taking Florida to cover ${spread}.`
        : `You’re taking Florida not to cover ${spread}.`;

  return (
    <div
      className={`gv-gz${locked ? ' is-locked' : ''}${justLocked ? ' is-seal' : ''}`}
      data-testid="vault-game-zone"
    >
      <div className="gv-gz__atmosphere" aria-hidden="true" />

      {loading && !HAS_GAME_ZONE_SEED && (
        <div className="gv-gz__status">
          <p>Loading Swamp Eve…</p>
        </div>
      )}

      {error && !loading && !HAS_GAME_ZONE_SEED && (
        <div className="gv-gz__status">
          <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
        </div>
      )}

      {(HAS_GAME_ZONE_SEED || (!loading && !error)) && nextGame && (
        <>
          <section className="gv-gz__stage" aria-label="Swamp Eve">
            <p className="gv-gz__brand">GatorVault</p>
            <p className="gv-gz__kicker">Swamp Eve</p>
            <p className="gv-gz__countdown">{countdownLabel(nextGame)}</p>
            <h1 className="gv-gz__matchup">
              <span className="gv-gz__team">Florida</span>
              <span className="gv-gz__vs">vs</span>
              <span className="gv-gz__team gv-gz__team--opp">{opp}</span>
            </h1>
            <p className="gv-gz__meta">
              <span>{formatKickoff(nextGame)}</span>
              <span>{venue}</span>
              {schedule?.tv ? <span>{schedule.tv}</span> : null}
            </p>

            <div className="gv-gz__line" aria-label="The line">
              <div>
                <p className="gv-gz__line-label">Spread</p>
                <p className="gv-gz__line-value">{spread || 'TBA'}</p>
              </div>
              <div>
                <p className="gv-gz__line-label">Total</p>
                <p className="gv-gz__line-value">{total || 'TBA'}</p>
              </div>
              <div>
                <p className="gv-gz__line-label">Vault outlook</p>
                <p className="gv-gz__line-value">{outlook || '—'}</p>
              </div>
            </div>

            <p className="gv-gz__headline">
              {locked ? 'Your Swamp Eve ticket is locked.' : 'Build your Swamp Eve ticket.'}
            </p>
            <p className="gv-gz__support">
              {locked
                ? 'Hold it until the final whistle. Watch kickoff on Gators Live — full prep stays on Game Week.'
                : 'Call the cover and the final score. Your ticket stays with you until kickoff.'}
            </p>

            <div className="gv-gz__cover" role="group" aria-label="Cover call">
              <p className="gv-gz__cover-label">Does Florida cover?</p>
              <div className="gv-gz__cover-row">
                <button
                  type="button"
                  className={`gv-gz__cover-btn${cover === 'cover' ? ' is-active' : ''}`}
                  disabled={locked}
                  onClick={() => setCover('cover')}
                >
                  Covers {spread || ''}
                </button>
                <button
                  type="button"
                  className={`gv-gz__cover-btn${cover === 'no-cover' ? ' is-active' : ''}`}
                  disabled={locked}
                  onClick={() => setCover('no-cover')}
                >
                  Does not cover
                </button>
              </div>
              {coverHint ? <p className="gv-gz__cover-hint">{coverHint}</p> : null}
            </div>

            <div className={`gv-gz__ticket${locked ? ' is-locked' : ''}`} aria-live="polite">
              <div className="gv-gz__scoreboard">
                <div className="gv-gz__side">
                  <p className="gv-gz__side-label">Florida</p>
                  <div className="gv-gz__dial">
                    {!locked ? (
                      <button type="button" className="gv-gz__nudge" onClick={() => nudge('uf', 1)} aria-label="Increase Florida score">
                        +
                      </button>
                    ) : null}
                    <input
                      className="gv-gz__score"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={ufScore}
                      disabled={locked}
                      onChange={(e) => setUfScore(String(clampScore(parseInt(e.target.value, 10) || 0)))}
                      aria-label="Florida score prediction"
                    />
                    {!locked ? (
                      <button type="button" className="gv-gz__nudge" onClick={() => nudge('uf', -1)} aria-label="Decrease Florida score">
                        −
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="gv-gz__mid" aria-hidden="true">
                  <span>{locked ? 'TICKET' : `${margin >= 0 ? '+' : ''}${margin}`}</span>
                </div>
                <div className="gv-gz__side">
                  <p className="gv-gz__side-label">{opp}</p>
                  <div className="gv-gz__dial">
                    {!locked ? (
                      <button type="button" className="gv-gz__nudge" onClick={() => nudge('opp', 1)} aria-label={`Increase ${opp} score`}>
                        +
                      </button>
                    ) : null}
                    <input
                      className="gv-gz__score"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={99}
                      value={oppScore}
                      disabled={locked}
                      onChange={(e) => setOppScore(String(clampScore(parseInt(e.target.value, 10) || 0)))}
                      aria-label={`${opp} score prediction`}
                    />
                    {!locked ? (
                      <button type="button" className="gv-gz__nudge" onClick={() => nudge('opp', -1)} aria-label={`Decrease ${opp} score`}>
                        −
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
              {locked ? <div className="gv-gz__seal" aria-hidden="true">Locked</div> : null}
            </div>

            <div className="gv-gz__cta-row">
              {locked ? (
                <>
                  <VaultNavLink href="/vault/live-scores/" className="gv-gz__cta">
                    Open Gators Live
                  </VaultNavLink>
                  <button type="button" className="gv-gz__cta gv-gz__cta--ghost" onClick={clearTicket}>
                    Change ticket
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="gv-gz__cta"
                  onClick={lockTicket}
                  disabled={!cover || !ufScore.trim() || !oppScore.trim()}
                >
                  Lock ticket
                </button>
              )}
            </div>
          </section>

          <section className="gv-gz__intel" aria-label="Keys to the game">
            <div className="gv-gz__intel-head">
              <p className="gv-gz__intel-kicker">Before kickoff</p>
              <h2 className="gv-gz__intel-title">Keys to {opp}</h2>
              {film ? <p className="gv-gz__intel-film">{film}</p> : null}
            </div>
            <ol className="gv-gz__keys">
              {keys.map((key, i) => (
                <li key={key} className="gv-gz__key">
                  <span className="gv-gz__key-num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="gv-gz__key-text">{key}</span>
                </li>
              ))}
            </ol>
            <VaultNavLink href="/vault/game-week/" className="gv-gz__intel-link">
              Open full Game Week briefing
            </VaultNavLink>
          </section>

          {locked ? (
            <section className="gv-gz__doors" aria-label="After your ticket">
              <p className="gv-gz__doors-kicker">Ticket locked. Go where the game lives.</p>
              <div className="gv-gz__door-grid">
                <VaultNavLink href="/vault/game-week/" className="gv-gz__door">
                  <span className="gv-gz__door-title">Game Week</span>
                  <span className="gv-gz__door-copy">Full matchup briefing</span>
                </VaultNavLink>
                <VaultNavLink href="/vault/live-scores/" className="gv-gz__door">
                  <span className="gv-gz__door-title">Gators Live</span>
                  <span className="gv-gz__door-copy">Scoreboard at kickoff</span>
                </VaultNavLink>
                <VaultNavLink href="/vault/film-room/" className="gv-gz__door">
                  <span className="gv-gz__door-title">Film Room</span>
                  <span className="gv-gz__door-copy">Pressers and tape</span>
                </VaultNavLink>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

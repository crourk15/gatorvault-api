'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import { UiError } from '@/components/site/UiMessage';
import { VaultNavLink } from '@/components/vault/VaultNavLink';
import '@/lib/game-zone-ritual.css';

const PRED_PREFIX = 'gv_gz_prediction_';

function opponentName(g?: BettingGame | null): string {
  if (!g) return 'Opponent';
  const away = g.awayTeam || g.away || '';
  const home = g.homeTeam || g.home || '';
  if (away === 'UF' || away === 'Florida') return home || 'Opponent';
  if (home === 'UF' || home === 'Florida') return away || 'Opponent';
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

function kickoffLabel(g?: BettingGame | null): string {
  if (!g) return 'Kickoff TBA';
  return g.kickoff || g.date || 'Kickoff TBA';
}

function clampScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(99, Math.round(n)));
}

type SavedPick = { uf: string; opp: string; lockedAt: string };

export function VaultGameZonePage(): React.ReactElement {
  const [nextGame, setNextGame] = useState<BettingGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ufScore, setUfScore] = useState('24');
  const [oppScore, setOppScore] = useState('17');
  const [pick, setPick] = useState<SavedPick | null>(null);
  const [justLocked, setJustLocked] = useState(false);

  const storageKey = useMemo(() => PRED_PREFIX + gameKey(nextGame), [nextGame]);
  const opp = opponentName(nextGame);
  const spread = spreadLine(nextGame);
  const total = nextGame?.total != null ? String(nextGame.total) : null;
  const locked = Boolean(pick);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBettingLines();
      setNextGame(data.nextGame ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the next game.');
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
        setPick(null);
        setJustLocked(false);
        return;
      }
      const saved = JSON.parse(raw) as SavedPick;
      if (saved?.uf && saved?.opp) {
        setPick(saved);
        setUfScore(saved.uf);
        setOppScore(saved.opp);
      }
    } catch {
      setPick(null);
    }
  }, [storageKey]);

  const nudge = (side: 'uf' | 'opp', delta: number) => {
    if (locked) return;
    if (side === 'uf') {
      setUfScore(String(clampScore((parseInt(ufScore, 10) || 0) + delta)));
    } else {
      setOppScore(String(clampScore((parseInt(oppScore, 10) || 0) + delta)));
    }
  };

  const lockPick = () => {
    if (!ufScore.trim() || !oppScore.trim()) return;
    const saved: SavedPick = {
      uf: String(clampScore(parseInt(ufScore, 10))),
      opp: String(clampScore(parseInt(oppScore, 10))),
      lockedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
    setPick(saved);
    setUfScore(saved.uf);
    setOppScore(saved.opp);
    setJustLocked(true);
    window.setTimeout(() => setJustLocked(false), 1200);
  };

  const clearPick = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setPick(null);
    setJustLocked(false);
  };

  return (
    <div
      className={`gv-gz${locked ? ' is-locked' : ''}${justLocked ? ' is-seal' : ''}`}
      data-testid="vault-game-zone"
    >
      <div className="gv-gz__atmosphere" aria-hidden="true" />

      {loading && (
        <div className="gv-gz__status">
          <p>Loading the next Swamp kickoff…</p>
        </div>
      )}

      {error && !loading && (
        <div className="gv-gz__status">
          <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
        </div>
      )}

      {!loading && !error && (
        <>
          <section className="gv-gz__stage" aria-label="Game Zone ritual">
            <p className="gv-gz__brand">GatorVault</p>
            <p className="gv-gz__kicker">Next in the Swamp</p>
            <h1 className="gv-gz__matchup">
              <span className="gv-gz__team">Florida</span>
              <span className="gv-gz__vs">vs</span>
              <span className="gv-gz__team gv-gz__team--opp">{opp}</span>
            </h1>
            <p className="gv-gz__meta">
              <span>{kickoffLabel(nextGame)}</span>
              {spread ? <span>{spread}</span> : null}
              {total ? <span>O/U {total}</span> : null}
            </p>

            <p className="gv-gz__headline">
              {locked ? 'Your score is locked.' : 'Lock your Swamp score.'}
            </p>
            <p className="gv-gz__support">
              {locked
                ? 'Hold this pick until the final whistle — then open Gators Live for the board.'
                : 'One pick. This device. This game. No points ladder. No fake live feed.'}
            </p>

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
                  <span>{locked ? 'FINAL?' : 'PICK'}</span>
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

              {locked ? (
                <div className="gv-gz__seal" aria-hidden="true">
                  Locked
                </div>
              ) : null}
            </div>

            <div className="gv-gz__cta-row">
              {locked ? (
                <>
                  <VaultNavLink href="/vault/live-scores/" className="gv-gz__cta">
                    Open Gators Live
                  </VaultNavLink>
                  <button type="button" className="gv-gz__cta gv-gz__cta--ghost" onClick={clearPick}>
                    Change pick
                  </button>
                </>
              ) : (
                <button type="button" className="gv-gz__cta" onClick={lockPick}>
                  Lock score
                </button>
              )}
            </div>
          </section>

          {locked ? (
            <section className="gv-gz__doors" aria-label="After your pick">
              <p className="gv-gz__doors-kicker">You are set. Go where the game lives.</p>
              <div className="gv-gz__door-grid">
                <VaultNavLink href="/vault/game-week/" className="gv-gz__door">
                  <span className="gv-gz__door-title">Game Week</span>
                  <span className="gv-gz__door-copy">Keys, matchup, briefing</span>
                </VaultNavLink>
                <VaultNavLink href="/vault/live-scores/" className="gv-gz__door">
                  <span className="gv-gz__door-title">Gators Live</span>
                  <span className="gv-gz__door-copy">Scoreboard when it kicks</span>
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

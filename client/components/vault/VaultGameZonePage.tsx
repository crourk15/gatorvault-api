'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import { UiError } from '@/components/site/UiMessage';
import { Chip, PageLayout } from '@/components/brand';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

const PRED_PREFIX = 'gv_gz_prediction_';

const TRIVIA = {
  question: 'Who was the last Florida Gators QB to win the Heisman Trophy?',
  options: [
    { id: 'a', label: 'Danny Wuerffel', correct: false },
    { id: 'b', label: 'Tim Tebow', correct: true },
    { id: 'c', label: 'Rex Grossman', correct: false },
    { id: 'd', label: 'Chris Leak', correct: false },
  ],
  explain: 'Tim Tebow won the Heisman in 2007.',
};

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

type SavedPick = { uf: string; opp: string; lockedAt: string };

export function VaultGameZonePage(): React.ReactElement {
  const [nextGame, setNextGame] = useState<BettingGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ufScore, setUfScore] = useState('');
  const [oppScore, setOppScore] = useState('');
  const [pick, setPick] = useState<SavedPick | null>(null);
  const [triviaChoice, setTriviaChoice] = useState<string | null>(null);
  const [triviaMsg, setTriviaMsg] = useState('One quick Gators question — no points ladder, just for fun.');

  const storageKey = useMemo(() => PRED_PREFIX + gameKey(nextGame), [nextGame]);
  const opp = opponentName(nextGame);
  const spread = spreadLine(nextGame);
  const total = nextGame?.total != null ? String(nextGame.total) : null;

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

  const lockPick = () => {
    if (!ufScore.trim() || !oppScore.trim()) return;
    const saved: SavedPick = {
      uf: ufScore.trim(),
      opp: oppScore.trim(),
      lockedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
    setPick(saved);
  };

  const clearPick = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    setPick(null);
    setUfScore('');
    setOppScore('');
  };

  const answerTrivia = (id: string, correct: boolean) => {
    setTriviaChoice(id);
    setTriviaMsg(correct ? `Correct — ${TRIVIA.explain}` : `Not quite — ${TRIVIA.explain}`);
  };

  return (
    <PageLayout
      theme="navy"
      title="Game Zone"
      subtitle="Pre-kickoff picks for the next Gators game — lock a score, then jump to Game Week or Gators Live."
      testId="vault-game-zone"
      className="gv-game-zone-page"
      accent={<Chip variant="orange">Pre-kickoff</Chip>}
    >
      {loading && <p className="gv-page-status">Loading next game…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && (
        <>
          <section className="gv-game-zone__card gv-game-zone__card--hero" aria-label="Next Gators game">
            <div className="gv-game-zone__card-head">
              <div>
                <p className="gv-game-zone__eyebrow">Next game</p>
                <h2 className="gv-game-zone__card-title">Florida vs {opp}</h2>
                <p className="gv-game-zone__card-sub">{kickoffLabel(nextGame)}</p>
              </div>
            </div>
            <div className="gv-game-zone__stats">
              <div className="gv-game-zone__stat">
                <p>Spread</p>
                <strong>{spread || 'Line TBA'}</strong>
              </div>
              <div className="gv-game-zone__stat">
                <p>Total</p>
                <strong>{total || 'TBA'}</strong>
              </div>
              <div className="gv-game-zone__stat">
                <p>Your job here</p>
                <strong>Lock a score pick before kickoff</strong>
              </div>
            </div>
          </section>

          <section className="gv-game-zone__card" aria-label="Score pick">
            <div className="gv-game-zone__card-head">
              <div>
                <h2 className="gv-game-zone__card-title">Lock your score</h2>
                <p className="gv-game-zone__card-sub">
                  Saved on this device for this game. No fake leaderboard and no membership points.
                </p>
              </div>
            </div>

            {pick ? (
              <div className="gv-game-zone__locked">
                <p className="gv-game-zone__pred-result">
                  Your pick is locked: Florida {pick.uf} – {opp} {pick.opp}
                </p>
                <p className="gv-game-zone__card-sub">
                  Come back after the final whistle and compare. For live scoreboard action, use Gators Live.
                </p>
                <div className="gv-game-zone__actions">
                  <button type="button" className="gv-game-zone__btn gv-game-zone__btn--ghost" onClick={clearPick}>
                    Change pick
                  </button>
                  <VaultNavLink href="/vault/live-scores/" className="gv-game-zone__btn">
                    Open Gators Live
                  </VaultNavLink>
                </div>
              </div>
            ) : (
              <>
                <div className="gv-game-zone__score-row">
                  <div className="gv-game-zone__score-cell">
                    <p className="gv-game-zone__score-label">Florida</p>
                    <input
                      type="number"
                      className="gv-game-zone__score-input"
                      placeholder="0"
                      min={0}
                      max={99}
                      inputMode="numeric"
                      value={ufScore}
                      onChange={(e) => setUfScore(e.target.value)}
                      aria-label="Florida score prediction"
                    />
                  </div>
                  <span className="gv-game-zone__vs">vs</span>
                  <div className="gv-game-zone__score-cell">
                    <p className="gv-game-zone__score-label">{opp}</p>
                    <input
                      type="number"
                      className="gv-game-zone__score-input"
                      placeholder="0"
                      min={0}
                      max={99}
                      inputMode="numeric"
                      value={oppScore}
                      onChange={(e) => setOppScore(e.target.value)}
                      aria-label={`${opp} score prediction`}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="gv-game-zone__btn"
                  onClick={lockPick}
                  disabled={!ufScore.trim() || !oppScore.trim()}
                >
                  Lock pick
                </button>
              </>
            )}
          </section>

          <section className="gv-game-zone__card" aria-label="Where to go next">
            <div className="gv-game-zone__card-head">
              <div>
                <h2 className="gv-game-zone__card-title">Game-day doors</h2>
                <p className="gv-game-zone__card-sub">
                  Game Zone is for your pick. Use these for prep and live scores.
                </p>
              </div>
            </div>
            <div className="gv-game-zone__doors">
              <VaultNavLink href="/vault/game-week/" className="gv-game-zone__door">
                <span className="gv-game-zone__door-title">Game Week</span>
                <span className="gv-game-zone__door-sub">Matchup prep and briefing</span>
              </VaultNavLink>
              <VaultNavLink href="/vault/live-scores/" className="gv-game-zone__door">
                <span className="gv-game-zone__door-title">Gators Live</span>
                <span className="gv-game-zone__door-sub">Scoreboard when the ball is in the air</span>
              </VaultNavLink>
              <VaultNavLink href="/vault/film-room/" className="gv-game-zone__door">
                <span className="gv-game-zone__door-title">Film Room</span>
                <span className="gv-game-zone__door-sub">Pressers and tape</span>
              </VaultNavLink>
            </div>
          </section>

          <section className="gv-game-zone__card" aria-label="Gators trivia">
            <div className="gv-game-zone__card-head">
              <div>
                <h2 className="gv-game-zone__card-title">Quick trivia</h2>
                <p className="gv-game-zone__card-sub">{TRIVIA.question}</p>
              </div>
            </div>
            <div className="gv-game-zone__poll">
              {TRIVIA.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className={`gv-game-zone__poll-btn${triviaChoice === o.id ? ' is-active' : ''}`}
                  onClick={() => answerTrivia(o.id, o.correct)}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <p className="gv-game-zone__poll-meta">{triviaMsg}</p>
          </section>

          <p className="gv-game-zone__footnote">
            Lines update from the next scheduled Florida game when available. This page does not show live
            play-by-play — that belongs on Gators Live.
          </p>
        </>
      )}
    </PageLayout>
  );
}

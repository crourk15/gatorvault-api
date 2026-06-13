'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import {
  addVaultPoints,
  getPointsTier,
  getVaultPoints,
  hasOneTimeKey,
  markOneTimeKey,
  nextTierLabel,
  POINTS_TIERS,
  pointsProgressPct,
} from '@/lib/vault-points';
import { UiError } from '@/components/site/UiMessage';

const PRED_STORAGE = 'gv_prediction';
const PRED_POINTS_KEY = 'gv_predPoints';
const TRIVIA_POINTS_KEY = 'gv_triviaPoints';

const POLL_OPTIONS = [
  { id: 'jones', label: 'Tramell Jones Jr.', pct: 42 },
  { id: 'philo', label: 'Aaron Philo', pct: 38 },
  { id: 'warner', label: 'Aidan Warner', pct: 20 },
];

const TRIVIA_OPTIONS = [
  { id: 'wrong1', label: 'A. Danny Wuerffel', correct: false },
  { id: 'correct', label: 'B. Tim Tebow', correct: true },
  { id: 'wrong2', label: 'C. Rex Grossman', correct: false },
  { id: 'wrong3', label: 'D. Chris Leak', correct: false },
];

function gameLabel(g?: BettingGame | null): string {
  if (!g) return 'UF vs FAU — Sep 5 • The Swamp';
  const away = g.awayTeam || g.away || 'Opponent';
  const home = g.homeTeam || g.home || 'UF';
  const date = g.date || g.kickoff || '';
  return `UF vs ${away === 'UF' ? home : away}${date ? ` — ${date}` : ''}`;
}

function spreadLine(g?: BettingGame | null): string {
  if (!g?.spread) return 'UF -8.5';
  if (typeof g.spread === 'string') return g.spread;
  return g.spread.line || 'UF -8.5';
}

export function VaultGameZonePage(): React.ReactElement {
  const [lines, setLines] = useState<BettingGame | null>(null);
  const [nextGame, setNextGame] = useState<BettingGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ufScore, setUfScore] = useState('');
  const [oppScore, setOppScore] = useState('');
  const [predLocked, setPredLocked] = useState(false);
  const [predMsg, setPredMsg] = useState('');
  const [pollChoice, setPollChoice] = useState<string | null>(null);
  const [pollMsg, setPollMsg] = useState('312 votes cast');
  const [triviaChoice, setTriviaChoice] = useState<string | null>(null);
  const [triviaMsg, setTriviaMsg] = useState('Answer correctly to earn Vault Points.');
  const [points, setPoints] = useState(0);
  const [tier, setTier] = useState<'scout' | 'insider' | 'elite'>('scout');

  const refreshPoints = useCallback(() => {
    const pts = getVaultPoints();
    setPoints(pts);
    setTier(getPointsTier(pts));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBettingLines();
      setNextGame(data.nextGame ?? null);
      setLines(data.nextGame ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load betting lines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshPoints();
    try {
      const saved = JSON.parse(localStorage.getItem(PRED_STORAGE) || 'null') as {
        uf?: string;
        opp?: string;
      } | null;
      if (saved?.uf && saved?.opp) {
        setUfScore(saved.uf);
        setOppScore(saved.opp);
        setPredLocked(true);
        setPredMsg(`Your pick: UF ${saved.uf} – ${saved.opp}. Locked in locally — check back after kickoff.`);
      }
    } catch {
      /* ignore */
    }
    void load();
  }, [load, refreshPoints]);

  const submitPrediction = () => {
    if (!ufScore.trim() || !oppScore.trim()) return;
    try {
      localStorage.setItem(
        PRED_STORAGE,
        JSON.stringify({ uf: ufScore.trim(), opp: oppScore.trim(), game: 'fau' })
      );
    } catch {
      /* ignore */
    }
    setPredLocked(true);
    setPredMsg(
      `Prediction locked! You picked UF ${ufScore} – ${oppScore}. Community line: ${spreadLine(nextGame)}.`
    );
    if (!hasOneTimeKey(PRED_POINTS_KEY)) {
      addVaultPoints(25);
      markOneTimeKey(PRED_POINTS_KEY);
      refreshPoints();
    }
  };

  const pickPoll = (id: string) => {
    setPollChoice(id);
    setPollMsg('Vote recorded — 313 fans have weighed in.');
  };

  const pickTrivia = (id: string, correct: boolean) => {
    setTriviaChoice(id);
    if (correct) {
      setTriviaMsg('Correct! Tim Tebow won the Heisman in 2007.');
      if (!hasOneTimeKey(TRIVIA_POINTS_KEY)) {
        addVaultPoints(15);
        markOneTimeKey(TRIVIA_POINTS_KEY);
        refreshPoints();
      }
    } else {
      setTriviaMsg('Not quite — the answer is B. Tim Tebow (2007).');
    }
  };

  const oppName =
    nextGame?.awayTeam === 'UF' || nextGame?.away === 'UF'
      ? nextGame?.homeTeam || nextGame?.home || 'FAU'
      : nextGame?.awayTeam || nextGame?.away || 'FAU';

  return (
    <div className="gv-game-zone" data-testid="vault-game-zone">
      <div className="gv-page-hero gv-game-zone__hero">
        <div>
          <h1 className="gv-page-title">🏆 Game Zone</h1>
          <p className="gv-page-subtitle">
            Predictions, live trend signals, fan polls, and Vault point progress — sharpen your picks
            before kickoff.
          </p>
        </div>
        <span className="gv-game-zone__pill">Live Match Insight</span>
      </div>

      {loading && <p className="gv-page-status">Loading game data…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!loading && !error && (
        <>
          <div className="gv-game-zone__grid gv-game-zone__grid--2">
            <section className="gv-game-zone__card">
              <div className="gv-game-zone__card-head">
                <div>
                  <h2 className="gv-game-zone__card-title">🎯 Score Predictor</h2>
                  <p className="gv-game-zone__card-sub">
                    Next Game: <strong>{gameLabel(nextGame)}</strong>
                  </p>
                </div>
                <span className="gv-game-zone__pill">Pro Tip</span>
              </div>
              <div className="gv-game-zone__score-row">
                <div className="gv-game-zone__score-cell">
                  <p className="gv-game-zone__score-label">🐊 UF</p>
                  <input
                    type="number"
                    className="gv-game-zone__score-input"
                    placeholder="0"
                    min={0}
                    max={99}
                    value={ufScore}
                    onChange={(e) => setUfScore(e.target.value)}
                  />
                </div>
                <span className="gv-game-zone__vs">vs</span>
                <div className="gv-game-zone__score-cell">
                  <p className="gv-game-zone__score-label">{oppName}</p>
                  <input
                    type="number"
                    className="gv-game-zone__score-input"
                    placeholder="0"
                    min={0}
                    max={99}
                    value={oppScore}
                    onChange={(e) => setOppScore(e.target.value)}
                  />
                </div>
              </div>
              <button type="button" className="gv-alert-save-btn" onClick={submitPrediction}>
                Submit Prediction
              </button>
              {predLocked && predMsg ? (
                <p className="gv-game-zone__pred-result">{predMsg}</p>
              ) : null}
              <div className="gv-game-zone__stats">
                <div className="gv-game-zone__stat">
                  <p>Community line</p>
                  <strong>{spreadLine(lines)}</strong>
                </div>
                <div className="gv-game-zone__stat">
                  <p>Projected total</p>
                  <strong>{nextGame?.total ?? '48.5'}</strong>
                </div>
                <div className="gv-game-zone__stat">
                  <p>Confidence</p>
                  <strong>74%</strong>
                </div>
                <div className="gv-game-zone__stat">
                  <p>Fast facts</p>
                  <strong>UF holds a +3 turnover differential over last 5 games.</strong>
                </div>
              </div>
            </section>

            <section className="gv-game-zone__card">
              <div className="gv-game-zone__card-head">
                <div>
                  <h2 className="gv-game-zone__card-title">📌 Game Pulse</h2>
                  <p className="gv-game-zone__card-sub">Key matchup notes and what to watch before kickoff.</p>
                </div>
                <span className="gv-game-zone__pill">Early Edge</span>
              </div>
              <div className="gv-game-zone__stats">
                <div className="gv-game-zone__stat">
                  <p>Rush Defense</p>
                  <strong>UF ranked top 10 nationally</strong>
                </div>
                <div className="gv-game-zone__stat">
                  <p>Turnover Margin</p>
                  <strong>+1.2 per game</strong>
                </div>
                <div className="gv-game-zone__stat">
                  <p>Opponent injury</p>
                  <strong>{oppName} RB questionable</strong>
                </div>
                <div className="gv-game-zone__stat">
                  <p>Weather note</p>
                  <strong>Clear evening, 74°F</strong>
                </div>
              </div>
              <div className="gv-game-zone__notes">
                <p>
                  UF has won 7 of the last 8 matchups against non-conference opponents in Florida. Expect
                  a strong second-half push.
                </p>
                <p>Best bet: lean the over if UF averages 5.4 yards per rush in the first quarter.</p>
              </div>
            </section>
          </div>

          <div className="gv-game-zone__grid gv-game-zone__grid--2">
            <section className="gv-game-zone__card">
              <div className="gv-game-zone__card-head">
                <div>
                  <h2 className="gv-game-zone__card-title">📊 Prediction Leaderboard</h2>
                  <p className="gv-game-zone__card-sub">Top fans by prediction accuracy and points.</p>
                </div>
                <span className="gv-game-zone__pill">Rankings</span>
              </div>
              <p className="gv-game-zone__leaderboard-empty">
                Leaderboard will activate when members begin making predictions.
              </p>
            </section>

            <section className="gv-game-zone__card">
              <div className="gv-game-zone__card-head">
                <div>
                  <h2 className="gv-game-zone__card-title">📊 Weekly Poll</h2>
                  <p className="gv-game-zone__card-sub">Who wins the starting QB job in 2026?</p>
                </div>
                <span className="gv-game-zone__pill">Fan Vote</span>
              </div>
              <div className="gv-game-zone__poll">
                {POLL_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`gv-game-zone__poll-btn${pollChoice === o.id ? ' is-active' : ''}`}
                    onClick={() => pickPoll(o.id)}
                  >
                    {o.label} — {o.pct}%
                  </button>
                ))}
              </div>
              <p className="gv-game-zone__poll-meta">{pollMsg}</p>
            </section>
          </div>

          <div className="gv-game-zone__grid gv-game-zone__grid--2">
            <section className="gv-game-zone__card">
              <h2 className="gv-game-zone__card-title">⭐ Your Vault Points</h2>
              <div className="gv-game-zone__points">
                <div className="gv-game-zone__points-val">
                  <p className="gv-game-zone__points-num">{points}</p>
                  <p className="gv-game-zone__points-label">Vault Points</p>
                </div>
                <div className="gv-game-zone__points-bar-wrap">
                  <div className="gv-game-zone__tier-labels">
                    <span>{POINTS_TIERS.scout.icon} Scout</span>
                    <span>{POINTS_TIERS.insider.icon} Insider</span>
                    <span>{POINTS_TIERS.elite.icon} Vault Elite</span>
                  </div>
                  <div className="gv-game-zone__points-bar">
                    <div
                      className="gv-game-zone__points-fill"
                      style={{ width: `${pointsProgressPct(points)}%` }}
                    />
                  </div>
                  <p className="gv-game-zone__points-next">{nextTierLabel(points)}</p>
                </div>
                <div className="gv-game-zone__tier-icons">
                  {(['scout', 'insider', 'elite'] as const).map((id) => (
                    <div
                      key={id}
                      className={`gv-game-zone__tier-icon${tier === id ? ' is-active' : ''}`}
                    >
                      <span>{POINTS_TIERS[id].icon}</span>
                      <p>{POINTS_TIERS[id].name}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="gv-game-zone__card">
              <h2 className="gv-game-zone__card-title">🧠 Daily Gator Trivia</h2>
              <p className="gv-game-zone__card-sub">
                Who was the last Florida Gators QB to win the Heisman Trophy?
              </p>
              <div className="gv-game-zone__poll">
                {TRIVIA_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className={`gv-game-zone__poll-btn${triviaChoice === o.id ? ' is-active' : ''}`}
                    onClick={() => pickTrivia(o.id, o.correct)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="gv-game-zone__poll-meta">{triviaMsg}</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}

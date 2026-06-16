'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Chip, GridLayout, PageLayout, PageSection } from '@/components/brand';
import { fetchBettingLines, type BettingGame } from '@/lib/betting-api';
import { UiEmpty, UiError } from '@/components/site/UiMessage';

const SEASON_STATS = [
  { label: 'Pass YPG', hint: 'Season opens Sep 5' },
  { label: 'Rush YPG', hint: 'Season opens Sep 5' },
  { label: 'PPG', hint: 'Season opens Sep 5' },
  { label: 'PPG Allowed', hint: 'Season opens Sep 5' },
];

const MOCK_DRIVE = [
  { q: 'Q1', plays: '8 plays, 72 yds', result: 'TD' },
  { q: 'Q2', plays: '6 plays, 41 yds', result: 'FG' },
  { q: 'Q3', plays: '3 plays, -2 yds', result: 'PUNT' },
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

function isUfGame(g: BettingGame): boolean {
  const { home, away } = gameTeams(g);
  return home.includes('Florida') || away.includes('Florida') || home === 'UF' || away === 'UF';
}

function formatScore(g: BettingGame): string {
  const h = g.homeScore != null ? g.homeScore : '-';
  const a = g.awayScore != null ? g.awayScore : '-';
  return `${h} - ${a}`;
}

function ScoreCard({ g, index }: { g: BettingGame; index: number }): React.ReactElement {
  const { home, away } = gameTeams(g);
  const live = isLive(g);
  const uf = isUfGame(g);
  return (
    <article
      key={g.id || g.game || index}
      className={`gv-live-scores__card${live ? ' is-live' : ''}${uf ? ' is-uf' : ''}`}
    >
      <div>
        {uf ? <Chip variant="orange">UF Game</Chip> : null}
        <p className="gv-live-scores__league">{g.game || 'GAME'}</p>
        <p className="gv-live-scores__matchup">
          {home} <span>vs</span> {away}
        </p>
        <p className="gv-live-scores__time">{g.kickoff || g.date || g.status || 'Scheduled'}</p>
      </div>
      <div className="gv-live-scores__score-block">
        <p className={`gv-live-scores__score${live ? ' gv-live-scores__score--green' : ''}`}>
          {formatScore(g)}
        </p>
        <p className="gv-live-scores__status">{g.status || (live ? 'Live' : 'Scheduled')}</p>
      </div>
    </article>
  );
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

  const ufGame = useMemo(() => games.find(isUfGame), [games]);
  const secGames = useMemo(
    () => games.filter((g) => (g.game || '').toUpperCase().includes('SEC') || isUfGame(g)).slice(0, 6),
    [games]
  );
  const top25 = useMemo(() => games.slice(0, 5), [games]);

  return (
    <PageLayout
      theme="navy"
      title="Live Scores"
      subtitle="Live updates every 60 seconds during game windows"
      testId="vault-live-scores"
      accent={
        hasLive ? (
          <span className="gv-live-scores__badge">
            <span className="gv-live-scores__dot" aria-hidden="true" />
            LIVE
          </span>
        ) : null
      }
    >
      {loading && games.length === 0 && <p className="gv-page-status">Loading scores…</p>}
      {error && !loading && (
        <UiError message={error} retry={() => void load()} backHref="/vault" backLabel="← Vault" />
      )}

      {!error && (
        <>
          <PageSection title="Current Games">
            <div className="gv-live-scores__list">
              {games.map((g, i) => (
                <ScoreCard key={g.id || g.game || i} g={g} index={i} />
              ))}
              {!loading && games.length === 0 && (
                <UiEmpty message="No live games right now." hint="Check back on gameday." />
              )}
            </div>
          </PageSection>

          <GridLayout cols={2}>
            <PageSection title="SEC Games">
              <div className="gv-live-scores__list">
                {secGames.map((g, i) => (
                  <ScoreCard key={`sec-${g.id || i}`} g={g} index={i} />
                ))}
              </div>
            </PageSection>
            <PageSection title="Top 25">
              <div className="gv-live-scores__list">
                {top25.map((g, i) => (
                  <ScoreCard key={`t25-${g.id || i}`} g={g} index={i} />
                ))}
              </div>
            </PageSection>
          </GridLayout>

          {ufGame && (
            <PageSection title="UF Drive Chart">
              <Card>
                <GridLayout cols={3}>
                  {MOCK_DRIVE.map((d) => (
                    <div key={d.q}>
                      <Chip variant="blue">{d.q}</Chip>
                      <p style={{ margin: '0.35rem 0' }}>{d.plays}</p>
                      <strong className={d.result === 'TD' ? 'gv-trend gv-trend--up' : ''}>{d.result}</strong>
                    </div>
                  ))}
                </GridLayout>
              </Card>
            </PageSection>
          )}

          <PageSection title="Scoring Summary">
            <Card>
              {ufGame ? (
                <p>
                  {gameTeams(ufGame).away} {ufGame.awayScore ?? 0} — {gameTeams(ufGame).home}{' '}
                  {ufGame.homeScore ?? 0}
                </p>
              ) : (
                <p>Scoring summary available during live games.</p>
              )}
            </Card>
          </PageSection>

          <PageSection title="2026 Season Stats">
            <div className="gv-live-scores__stats">
              {SEASON_STATS.map((s) => (
                <div key={s.label} className="gv-recruit-stat">
                  <span>{s.label}</span>
                  <strong>—</strong>
                  <p className="gv-live-scores__stat-hint">{s.hint}</p>
                </div>
              ))}
            </div>
          </PageSection>
        </>
      )}
    </PageLayout>
  );
}

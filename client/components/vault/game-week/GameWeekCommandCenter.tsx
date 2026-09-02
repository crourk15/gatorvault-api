'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bettingLineForScheduleGame,
  getGameWeekBundle,
  type GameWeekBettingLine,
} from '@/lib/game-week-data';
import { fetchBettingLines } from '@/lib/betting-api';
import { fetchScheduleGames } from '@/lib/schedule-api';
import { SCHEDULE_GAMES, type ScheduleGame } from '@/lib/schedule-data';
import { InsiderPaywall } from '@/components/futurecast/InsiderPaywall';
import { MatchupHeroWidget } from './MatchupHeroWidget';
import { SeasonTimeline } from './SeasonTimeline';
import { WinProbabilityGaugeWidget } from './WinProbabilityGaugeWidget';
import { ScoutingRadarChart } from './ScoutingRadarChart';
import { KeysToGameCards } from './KeysToGameCards';
import { SwingPlayersCards } from './SwingPlayersCards';
import { ExpectedVisitorsPanel } from './ExpectedVisitorsPanel';
import { FilmNotesPanel } from './FilmNotesPanel';
import { DepthChartGrid } from './DepthChartGrid';
import { ScoutingReportPanel } from './ScoutingReportPanel';
import { PredictionPanel } from './PredictionPanel';

const TABS = [
  { id: 'intel', label: 'Game Week Intel' },
  { id: 'depth', label: 'Depth Chart' },
  { id: 'scouting', label: 'Scouting Report' },
  { id: 'prediction', label: 'Prediction Panel' },
];

const FILM_INTEL_PAYWALL = {
  message:
    'Film Room unlocks full Game Week Intel — 3 Keys, expected visitors, swing players, and film notes from the matchup tape.',
  ctaLabel: 'Unlock Film Room',
} as const;

const FILM_SCOUTING_PAYWALL = {
  message:
    'Film Room unlocks the full Scouting Report — offense, defense, and how Florida wins this week.',
  ctaLabel: 'Unlock Film Room',
} as const;

type Props = {
  initialGameId?: string;
  onGameChange?: (gameId: string) => void;
};

export function GameWeekCommandCenter({ initialGameId = 'fau', onGameChange }: Props): React.ReactElement {
  const [gameId, setGameId] = useState(initialGameId);
  const [tab, setTab] = useState('intel');
  const [games, setGames] = useState<ScheduleGame[]>(SCHEDULE_GAMES);
  const [bettingByGameId, setBettingByGameId] = useState<Record<string, GameWeekBettingLine | null>>({});

  useEffect(() => {
    if (initialGameId) setGameId(initialGameId);
  }, [initialGameId]);

  // Live schedule board — weekly film/keys/scout edits publish without Codemagic.
  useEffect(() => {
    let cancelled = false;
    fetchScheduleGames(2026)
      .then((live) => {
        if (!cancelled && live.length) setGames(live);
      })
      .catch(() => {
        /* keep seed */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Vegas from /api/betting/lines — never invent spread/total from win% or FutureCast score.
  useEffect(() => {
    let cancelled = false;
    fetchBettingLines()
      .then((lines) => {
        if (cancelled) return;
        const pool = games.length ? games : SCHEDULE_GAMES;
        const next: Record<string, GameWeekBettingLine | null> = {};
        for (const g of pool) {
          next[g.id] = bettingLineForScheduleGame(g, lines);
        }
        setBettingByGameId(next);
      })
      .catch(() => {
        /* leave pending until lines load */
      });
    return () => {
      cancelled = true;
    };
  }, [games]);

  const betting = bettingByGameId[gameId] ?? null;
  const bundle = useMemo(
    () => getGameWeekBundle(gameId, games, betting),
    [gameId, games, betting]
  );

  const handleGameSelect = useCallback(
    (id: string) => {
      setGameId(id);
      onGameChange?.(id);
    },
    [onGameChange]
  );

  return (
    <div className="gv-gw-wow-root rh-cc-page" data-testid="game-week-command-center">
      <section className="gv-gw-wow-hero fc-lab-bleed" aria-label="Game week overview">
        <div className="gv-gw-wow-hero__bg" aria-hidden />
        <div className="gv-gw-wow-hero__inner rh-frame">
          <MatchupHeroWidget bundle={bundle} />
          <SeasonTimeline activeGameId={gameId} onSelect={handleGameSelect} games={games} />
          <div className="gv-gw-wow-hero__metrics">
            <WinProbabilityGaugeWidget ufPct={bundle.game.ufPct} prediction={bundle.prediction} />
            <ScoutingRadarChart axes={bundle.radar} opponentName={bundle.game.opp} />
          </div>
        </div>
      </section>

      <div className="gv-gw-wow-feed fc-lab-bleed">
        <div className="gv-gw-wow-feed__inner rh-frame">
          <div className="rh-cc-tabs gv-gw-wow-tabs" role="tablist" aria-label="Game week sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`rh-cc-tabs__btn${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'intel' ? (
            <InsiderPaywall variant="overlay" {...FILM_INTEL_PAYWALL}>
              <div className="gv-gw-wow-tab gv-gw-wow-tab--intel">
                <div className="gv-gw-wow-row gv-gw-wow-row--2">
                  <section className="gv-gw-wow-panel fc-lab-panel-shell">
                    <h3 className="gv-gw-wow-panel__title">3 Keys to the Game</h3>
                    <div className="gv-gw-wow-panel__body">
                      <KeysToGameCards keys={bundle.keys} />
                    </div>
                  </section>
                  <section className="gv-gw-wow-panel fc-lab-panel-shell">
                    <h3 className="gv-gw-wow-panel__title">Swing Players</h3>
                    <div className="gv-gw-wow-panel__body">
                      <SwingPlayersCards players={bundle.swingPlayers} />
                    </div>
                  </section>
                </div>
                {bundle.game.expectedVisitors?.visitors?.length ? (
                  <section
                    className="gv-gw-wow-panel fc-lab-panel-shell gv-gw-wow-panel--visitors"
                    data-testid="gw-expected-visitors-panel"
                  >
                    <h3 className="gv-gw-wow-panel__title">Expected visitors</h3>
                    <div className="gv-gw-wow-panel__body">
                      <ExpectedVisitorsPanel panel={bundle.game.expectedVisitors} />
                    </div>
                  </section>
                ) : null}
                <section className="gv-gw-wow-panel fc-lab-panel-shell">
                  <h3 className="gv-gw-wow-panel__title">Film Notes</h3>
                  <div className="gv-gw-wow-panel__body">
                    <FilmNotesPanel notes={bundle.filmNotes} />
                  </div>
                </section>
              </div>
            </InsiderPaywall>
          ) : null}

          {tab === 'depth' ? (
            <section className="gv-gw-wow-panel fc-lab-panel-shell">
              <h3 className="gv-gw-wow-panel__title">Depth chart</h3>
              <div className="gv-gw-wow-panel__body">
                <DepthChartGrid groups={bundle.depthChart} />
              </div>
            </section>
          ) : null}

          {tab === 'scouting' ? (
            <InsiderPaywall variant="overlay" {...FILM_SCOUTING_PAYWALL}>
              <section className="gv-gw-wow-panel fc-lab-panel-shell">
                <h3 className="gv-gw-wow-panel__title">Scouting report</h3>
                <div className="gv-gw-wow-panel__body">
                  <ScoutingReportPanel scouting={bundle.scouting} />
                </div>
              </section>
            </InsiderPaywall>
          ) : null}

          {tab === 'prediction' ? (
            <section className="gv-gw-wow-panel fc-lab-panel-shell">
              <h3 className="gv-gw-wow-panel__title">GatorVault prediction</h3>
              <div className="gv-gw-wow-panel__body">
                <PredictionPanel prediction={bundle.prediction} />
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

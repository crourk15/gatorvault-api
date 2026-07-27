'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getGameWeekBundle } from '@/lib/game-week-data';
import { MatchupHeroWidget } from './MatchupHeroWidget';
import { SeasonTimeline } from './SeasonTimeline';
import { WinProbabilityGaugeWidget } from './WinProbabilityGaugeWidget';
import { ScoutingRadarChart } from './ScoutingRadarChart';
import { KeysToGameCards } from './KeysToGameCards';
import { SwingPlayersCards } from './SwingPlayersCards';
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

type Props = {
  initialGameId?: string;
  onGameChange?: (gameId: string) => void;
};

export function GameWeekCommandCenter({ initialGameId = 'fau', onGameChange }: Props): React.ReactElement {
  const [gameId, setGameId] = useState(initialGameId);
  const [tab, setTab] = useState('intel');

  useEffect(() => {
    if (initialGameId) setGameId(initialGameId);
  }, [initialGameId]);

  const bundle = useMemo(() => getGameWeekBundle(gameId), [gameId]);

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
          <SeasonTimeline activeGameId={gameId} onSelect={handleGameSelect} />
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
              <section className="gv-gw-wow-panel fc-lab-panel-shell">
                <h3 className="gv-gw-wow-panel__title">Film Notes</h3>
                <div className="gv-gw-wow-panel__body">
                  <FilmNotesPanel notes={bundle.filmNotes} game={bundle.game} />
                </div>
              </section>
            </div>
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
            <section className="gv-gw-wow-panel fc-lab-panel-shell">
              <h3 className="gv-gw-wow-panel__title">Scouting report</h3>
              <div className="gv-gw-wow-panel__body">
                <ScoutingReportPanel scouting={bundle.scouting} />
              </div>
            </section>
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

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
    <div className="gv-gw-wow-root" data-testid="game-week-command-center">
      <MatchupHeroWidget bundle={bundle} />
      <SeasonTimeline activeGameId={gameId} onSelect={handleGameSelect} />

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
            <WinProbabilityGaugeWidget ufPct={bundle.game.ufPct} prediction={bundle.prediction} />
            <ScoutingRadarChart axes={bundle.radar} opponentName={bundle.game.opp} />
          </div>
          <div className="gv-gw-wow-row gv-gw-wow-row--2">
            <section className="gv-gw-wow-section">
              <h3 className="gv-gw-wow-section__title">3 Keys to the Game</h3>
              <KeysToGameCards keys={bundle.keys} />
            </section>
            <section className="gv-gw-wow-section">
              <h3 className="gv-gw-wow-section__title">Swing Players</h3>
              <SwingPlayersCards players={bundle.swingPlayers} />
            </section>
          </div>
          <section className="gv-gw-wow-section">
            <h3 className="gv-gw-wow-section__title">Film Notes</h3>
            <FilmNotesPanel notes={bundle.filmNotes} game={bundle.game} />
          </section>
        </div>
      ) : null}

      {tab === 'depth' ? (
        <section className="gv-gw-wow-section">
          <h3 className="gv-gw-wow-section__title">Projected depth chart</h3>
          <DepthChartGrid groups={bundle.depthChart} />
        </section>
      ) : null}

      {tab === 'scouting' ? (
        <section className="gv-gw-wow-section">
          <h3 className="gv-gw-wow-section__title">Scouting report</h3>
          <ScoutingReportPanel scouting={bundle.scouting} />
        </section>
      ) : null}

      {tab === 'prediction' ? (
        <section className="gv-gw-wow-section">
          <h3 className="gv-gw-wow-section__title">GatorVault prediction</h3>
          <PredictionPanel prediction={bundle.prediction} />
        </section>
      ) : null}
    </div>
  );
}

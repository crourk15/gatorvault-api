'use client';

import React from 'react';
import {
  daysUntilKickoffLabel,
  isRivalryGame,
  type PremiumScheduleGame,
} from '@/lib/schedule-premium';
import { opponentLogoUrl, ufLogoUrl } from '@/lib/team-logos';
import { GameActions } from './GameActions';
import { PredictedScoreBlock } from './PredictedScoreBlock';
import { TVNetworkBadge } from './TVNetworkBadge';
import { WinProbabilityBar } from './WinProbabilityBar';

type Props = {
  game: PremiumScheduleGame;
};

export function NextUpMatchup({ game }: Props): React.ReactElement {
  const rivalry = isRivalryGame(game);
  const countdown = daysUntilKickoffLabel(game.kickoffRaw);
  const matchup =
    game.homeOrAway === '@' ? `@ ${game.opponentShort}` : `vs ${game.opponentShort}`;

  return (
    <div
      className={`gv-sched-next${rivalry ? ' gv-sched-next--rivalry' : ''}`}
      data-testid="schedule-next-up"
    >
      <a href={game.intelUrl} className="gv-sched-next__main" data-testid="schedule-next-game-week">
        <div className="gv-sched-next__top">
          <span className="gv-sched-next__eyebrow">{rivalry ? 'Rivalry · Next up' : 'Next up'}</span>
          {countdown ? <span className="gv-sched-next__countdown">{countdown}</span> : null}
        </div>

        <div className="gv-sched-next__matchup">
          <div className="gv-sched-next__logos">
            <img
              src={ufLogoUrl()}
              alt="Florida Gators"
              className="gv-sched-next__logo gv-sched-next__logo--uf"
              width={72}
              height={72}
            />
            <span className="gv-sched-next__vs" aria-hidden="true">
              {game.homeOrAway === '@' ? '@' : 'vs'}
            </span>
            <img
              src={opponentLogoUrl(game.id)}
              alt={game.opponentName}
              className="gv-sched-next__logo gv-sched-next__logo--opp"
              width={72}
              height={72}
            />
          </div>
          <div className="gv-sched-next__identity">
            <h2 className="gv-sched-next__title">{matchup}</h2>
            <p className="gv-sched-next__full">{game.opponentName}</p>
            <p className="gv-sched-next__meta">
              {game.date} · {game.time}
            </p>
            <p className="gv-sched-next__meta">{game.stadium}</p>
            <TVNetworkBadge network={game.tvNetwork} />
          </div>
        </div>

        {game.keyTeaser ? <p className="gv-sched-next__teaser">{game.keyTeaser}</p> : null}

        <div className="gv-sched-next__intel">
          <WinProbabilityBar winProbability={game.winProbability} />
          <PredictedScoreBlock
            ufScore={game.predictedScoreUF}
            oppScore={game.predictedScoreOpp}
            oppName={game.opponentName}
            oppShort={game.opponentShort}
            gameId={game.id}
          />
        </div>

        <span className="gv-sched-next__gw">
          Open Game Week
          <span aria-hidden="true"> →</span>
        </span>
      </a>

      <div className="gv-sched-next__tickets">
        <GameActions ticketVendors={game.ticketVendors} opponentName={game.opponentName} />
      </div>
    </div>
  );
}

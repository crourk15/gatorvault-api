'use client';

import React from 'react';
import { Button } from '@/components/ui';
import {
  daysUntilKickoffLabel,
  isRivalryGame,
  type PremiumScheduleGame,
} from '@/lib/schedule-premium';
import { opponentLogoUrl, ufLogoUrl } from '@/lib/team-logos';
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
  const primaryTicket = game.ticketVendors[0];

  return (
    <div
      className={`gv-sched-next${rivalry ? ' gv-sched-next--rivalry' : ''}`}
      data-testid="schedule-next-up"
    >
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

      <div className="gv-sched-next__cta">
        <Button href={game.intelUrl} variant="primary">
          Game Week Intel →
        </Button>
        {primaryTicket ? (
          <Button href={primaryTicket.url} variant="secondary" target="_blank" rel="noopener noreferrer">
            Find tickets
          </Button>
        ) : null}
      </div>
    </div>
  );
}

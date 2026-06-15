'use client';

import React from 'react';
import { HeadingM, BodyM } from '@/components/ui';
import type { PremiumScheduleGame } from '@/lib/schedule-premium';
import { GameActions } from './GameActions';
import { PredictedScoreBlock } from './PredictedScoreBlock';
import { TVNetworkBadge } from './TVNetworkBadge';
import { WinProbabilityBar } from './WinProbabilityBar';

type Props = PremiumScheduleGame;

const BADGE_CLASS: Record<PremiumScheduleGame['homeOrAway'], string> = {
  vs: 'home',
  '@': 'away',
  neutral: 'neutral',
};

export function GameCard(props: Props): React.ReactElement {
  const {
    opponentName,
    opponentShort,
    opponentLogo,
    homeOrAway,
    date,
    time,
    stadium,
    tvNetwork,
    winProbability,
    predictedScoreUF,
    predictedScoreOpp,
    intelUrl,
    ticketVendors,
  } = props;

  return (
    <article className="gv-sched-game-card gv-ds-card" data-testid={`schedule-game-${props.id}`}>
      <div className="gv-sched-game-card__left">
        <span className={`gv-sched-game-card__badge gv-sched-game-card__badge--${BADGE_CLASS[homeOrAway]}`}>
          {homeOrAway === '@' ? 'AWAY' : homeOrAway === 'neutral' ? 'NEUTRAL' : 'HOME'}
        </span>
        <div className="gv-sched-game-card__identity">
          <span className="gv-sched-game-card__opp-logo" aria-hidden="true">
            {opponentLogo}
          </span>
          <div>
            <HeadingM className="gv-sched-game-card__opp-name">
              {homeOrAway === '@' ? `@ ${opponentShort}` : `vs ${opponentShort}`}
            </HeadingM>
            <BodyM className="gv-sched-game-card__opp-full">{opponentName}</BodyM>
          </div>
        </div>
        <div className="gv-sched-game-card__meta">
          <BodyM>{date}</BodyM>
          <BodyM>{time}</BodyM>
          <BodyM className="gv-sched-game-card__stadium">{stadium}</BodyM>
        </div>
      </div>

      <div className="gv-sched-game-card__center">
        <TVNetworkBadge network={tvNetwork} />
        <WinProbabilityBar winProbability={winProbability} />
        <PredictedScoreBlock
          ufScore={predictedScoreUF}
          oppScore={predictedScoreOpp}
          oppName={opponentName}
          oppLogo={opponentLogo}
        />
      </div>

      <div className="gv-sched-game-card__right">
        <GameActions intelUrl={intelUrl} ticketVendors={ticketVendors} />
      </div>
    </article>
  );
}

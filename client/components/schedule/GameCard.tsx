'use client';

import React from 'react';
import { HeadingM, BodyM } from '@/components/ui';
import type { PremiumScheduleGame, ScheduleGameStatus } from '@/lib/schedule-premium';
import { isRivalryGame } from '@/lib/schedule-premium';
import { opponentLogoUrl } from '@/lib/team-logos';
import { GameActions } from './GameActions';
import { PredictedScoreBlock } from './PredictedScoreBlock';
import { TVNetworkBadge } from './TVNetworkBadge';
import { WinProbabilityBar } from './WinProbabilityBar';

type Props = PremiumScheduleGame & {
  status?: ScheduleGameStatus;
};

const BADGE_CLASS: Record<PremiumScheduleGame['homeOrAway'], string> = {
  vs: 'home',
  '@': 'away',
  neutral: 'neutral',
};

export function GameCard(props: Props): React.ReactElement {
  const {
    id,
    opponentName,
    opponentShort,
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
    status = 'upcoming',
  } = props;

  const rivalry = isRivalryGame(props);
  const statusLabel = status === 'next' ? 'Next' : status === 'past' ? 'Final' : null;
  const matchup = homeOrAway === '@' ? `@ ${opponentShort}` : `vs ${opponentShort}`;

  return (
    <article
      className={[
        'gv-sched-game-card',
        'gv-ds-card',
        status === 'next' ? 'gv-sched-game-card--next' : '',
        status === 'past' ? 'gv-sched-game-card--past' : '',
        rivalry ? 'gv-sched-game-card--rivalry' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`schedule-game-${id}`}
      data-status={status}
    >
      <a href={intelUrl} className="gv-sched-game-card__main" data-testid={`schedule-game-week-${id}`}>
        <div className="gv-sched-game-card__left">
          <div className="gv-sched-game-card__badges">
            <span className={`gv-sched-game-card__badge gv-sched-game-card__badge--${BADGE_CLASS[homeOrAway]}`}>
              {homeOrAway === '@' ? 'AWAY' : homeOrAway === 'neutral' ? 'NEUTRAL' : 'HOME'}
            </span>
            {statusLabel ? (
              <span className={`gv-sched-game-card__badge gv-sched-game-card__badge--${status}`}>
                {statusLabel}
              </span>
            ) : null}
            {rivalry ? (
              <span className="gv-sched-game-card__badge gv-sched-game-card__badge--rivalry">Rivalry</span>
            ) : null}
          </div>
          <div className="gv-sched-game-card__identity">
            <img
              src={opponentLogoUrl(id)}
              alt=""
              className="gv-sched-game-card__opp-logo-img"
              width={48}
              height={48}
            />
            <div>
              <HeadingM className="gv-sched-game-card__opp-name">{matchup}</HeadingM>
              <BodyM className="gv-sched-game-card__opp-full">{opponentName}</BodyM>
            </div>
          </div>
          <div className="gv-sched-game-card__meta">
            <BodyM>{date}</BodyM>
            <BodyM>{time}</BodyM>
            <BodyM className="gv-sched-game-card__stadium">{stadium}</BodyM>
          </div>
          <span className="gv-sched-game-card__gw">
            Game Week
            <span aria-hidden="true"> →</span>
          </span>
        </div>

        <div className="gv-sched-game-card__center">
          <TVNetworkBadge network={tvNetwork} />
          {status !== 'past' ? (
            <>
              <WinProbabilityBar winProbability={winProbability} />
              <PredictedScoreBlock
                ufScore={predictedScoreUF}
                oppScore={predictedScoreOpp}
                oppName={opponentName}
                oppShort={opponentShort}
                gameId={id}
              />
            </>
          ) : (
            <p className="gv-sched-game-card__past-note">Result posts after kickoff.</p>
          )}
        </div>
      </a>

      <div className="gv-sched-game-card__right">
        <GameActions ticketVendors={ticketVendors} opponentName={opponentName} />
      </div>
    </article>
  );
}

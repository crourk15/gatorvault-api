'use client';

import React from 'react';
import { HeadingM, BodyM } from '@/components/ui';
import type { PremiumScheduleGame, ScheduleGameStatus } from '@/lib/schedule-premium';
import { hasPostedFinal, isRivalryGame } from '@/lib/schedule-premium';
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
    isBye,
    keyTeaser,
    finalUF,
    finalOpp,
    boxScoreUrl,
  } = props;

  const rivalry = isRivalryGame(props);
  const postedFinal = hasPostedFinal({ finalUF, finalOpp });
  const statusLabel = status === 'next' ? 'Next' : status === 'past' ? 'Final' : null;
  const matchup = isBye
    ? 'BYE'
    : homeOrAway === '@'
      ? `@ ${opponentShort}`
      : `vs ${opponentShort}`;

  return (
    <article
      className={[
        'gv-sched-game-card',
        'gv-ds-card',
        status === 'next' ? 'gv-sched-game-card--next' : '',
        status === 'past' ? 'gv-sched-game-card--past' : '',
        status === 'past' && postedFinal ? 'gv-sched-game-card--final' : '',
        rivalry ? 'gv-sched-game-card--rivalry' : '',
        isBye ? 'gv-sched-game-card--bye' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-testid={`schedule-game-${id}`}
      data-status={status}
    >
      <a href={intelUrl} className="gv-sched-game-card__main" data-testid={`schedule-game-week-${id}`}>
        <div className="gv-sched-game-card__left">
          <div className="gv-sched-game-card__badges">
            <span className={`gv-sched-game-card__badge gv-sched-game-card__badge--${isBye ? 'neutral' : BADGE_CLASS[homeOrAway]}`}>
              {isBye ? 'OFF' : homeOrAway === '@' ? 'AWAY' : homeOrAway === 'neutral' ? 'NEUTRAL' : 'HOME'}
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
            {!isBye ? (
              <img
                src={opponentLogoUrl(id)}
                alt=""
                className="gv-sched-game-card__opp-logo-img"
                width={48}
                height={48}
              />
            ) : null}
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
          {!isBye ? (
            <span className="gv-sched-game-card__gw">
              Game Week
              <span aria-hidden="true"> →</span>
            </span>
          ) : null}
        </div>

        <div className="gv-sched-game-card__center">
          {isBye ? (
            <p className="gv-sched-game-card__past-note">{keyTeaser || 'Open date on the SEC calendar.'}</p>
          ) : (
            <>
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
              ) : postedFinal && finalUF != null && finalOpp != null ? (
                <PredictedScoreBlock
                  ufScore={finalUF}
                  oppScore={finalOpp}
                  oppName={opponentName}
                  oppShort={opponentShort}
                  gameId={id}
                  label="Final"
                />
              ) : (
                <p className="gv-sched-game-card__past-note">Result posts after kickoff.</p>
              )}
            </>
          )}
        </div>
      </a>

      {!isBye ? (
        <div className="gv-sched-game-card__right">
          <GameActions ticketVendors={ticketVendors} opponentName={opponentName} />
          {boxScoreUrl ? (
            <a
              href={boxScoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gv-sched-game-card__box"
              data-testid={`schedule-box-${id}`}
            >
              Box score
              <span aria-hidden="true"> →</span>
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

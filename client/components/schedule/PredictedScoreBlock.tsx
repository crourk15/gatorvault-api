'use client';

import React from 'react';
import { opponentLogoUrl, ufLogoUrl } from '@/lib/team-logos';

type Props = {
  ufScore: number;
  oppScore: number;
  oppName: string;
  oppShort: string;
  gameId: string;
};

export function PredictedScoreBlock({
  ufScore,
  oppScore,
  oppName,
  oppShort,
  gameId,
}: Props): React.ReactElement {
  return (
    <div
      className="gv-sched-scoreboard"
      aria-label={`Model lean Florida ${ufScore}, ${oppName} ${oppScore}`}
    >
      <p className="gv-sched-scoreboard__label">Model lean</p>
      <div className="gv-sched-scoreboard__row">
        <img
          src={ufLogoUrl()}
          alt=""
          className="gv-sched-scoreboard__logo-img"
          width={28}
          height={28}
        />
        <span className="gv-sched-scoreboard__line">
          <span className="gv-sched-scoreboard__abbr">UF</span>
          <span className="gv-sched-scoreboard__score">{ufScore}</span>
          <span className="gv-sched-scoreboard__divider" aria-hidden="true">
            –
          </span>
          <span className="gv-sched-scoreboard__score">{oppScore}</span>
          <span className="gv-sched-scoreboard__abbr">{oppShort}</span>
        </span>
        <img
          src={opponentLogoUrl(gameId)}
          alt=""
          className="gv-sched-scoreboard__logo-img"
          width={28}
          height={28}
        />
      </div>
    </div>
  );
}

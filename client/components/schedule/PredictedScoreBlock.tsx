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
    <div className="gv-sched-scoreboard" aria-label={`Predicted score UF ${ufScore}, ${oppName} ${oppScore}`}>
      <div className="gv-sched-scoreboard__team gv-sched-scoreboard__team--uf">
        <img
          src={ufLogoUrl()}
          alt=""
          className="gv-sched-scoreboard__logo-img"
          width={28}
          height={28}
        />
        <span className="gv-sched-scoreboard__abbr">UF</span>
        <span className="gv-sched-scoreboard__score">{ufScore}</span>
      </div>
      <span className="gv-sched-scoreboard__divider" aria-hidden="true">
        —
      </span>
      <div className="gv-sched-scoreboard__team gv-sched-scoreboard__team--opp">
        <img
          src={opponentLogoUrl(gameId)}
          alt=""
          className="gv-sched-scoreboard__logo-img"
          width={28}
          height={28}
        />
        <span className="gv-sched-scoreboard__abbr">{oppShort}</span>
        <span className="gv-sched-scoreboard__score">{oppScore}</span>
      </div>
    </div>
  );
}

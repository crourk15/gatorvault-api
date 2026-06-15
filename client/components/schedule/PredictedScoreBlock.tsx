'use client';

import React from 'react';

type Props = {
  ufScore: number;
  oppScore: number;
  oppName: string;
  oppLogo: string;
};

export function PredictedScoreBlock({ ufScore, oppScore, oppName, oppLogo }: Props): React.ReactElement {
  return (
    <div className="gv-sched-scoreboard" aria-label={`Predicted score UF ${ufScore}, ${oppName} ${oppScore}`}>
      <div className="gv-sched-scoreboard__team gv-sched-scoreboard__team--uf">
        <span className="gv-sched-scoreboard__logo" aria-hidden="true">
          🐊
        </span>
        <span className="gv-sched-scoreboard__abbr">UF</span>
        <span className="gv-sched-scoreboard__score">{ufScore}</span>
      </div>
      <span className="gv-sched-scoreboard__divider" aria-hidden="true">
        —
      </span>
      <div className="gv-sched-scoreboard__team gv-sched-scoreboard__team--opp">
        <span className="gv-sched-scoreboard__logo gv-sched-scoreboard__logo--text" aria-hidden="true">
          {oppLogo}
        </span>
        <span className="gv-sched-scoreboard__abbr">{oppName.split(' ')[0]}</span>
        <span className="gv-sched-scoreboard__score">{oppScore}</span>
      </div>
    </div>
  );
}

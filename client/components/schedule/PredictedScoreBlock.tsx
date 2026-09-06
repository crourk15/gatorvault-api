'use client';

import React from 'react';
import { opponentLogoUrl, ufLogoUrl } from '@/lib/team-logos';

type Props = {
  ufScore: number;
  oppScore: number;
  oppName: string;
  oppShort: string;
  gameId: string;
  /** Default "Model lean". Past games with an official final use "Final". */
  label?: string;
};

export function PredictedScoreBlock({
  ufScore,
  oppScore,
  oppName,
  oppShort,
  gameId,
  label = 'Model lean',
}: Props): React.ReactElement {
  const isFinal = /^final$/i.test(label);
  return (
    <div
      className={`gv-sched-scoreboard${isFinal ? ' gv-sched-scoreboard--final' : ''}`}
      data-testid={isFinal ? `schedule-final-${gameId}` : `schedule-lean-${gameId}`}
      aria-label={`${label} Florida ${ufScore}, ${oppName} ${oppScore}`}
    >
      <p className="gv-sched-scoreboard__label">{label}</p>
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

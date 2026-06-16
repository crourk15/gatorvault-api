'use client';

import React from 'react';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { coerceDisplayText } from '@/lib/coerce-text';

type Props = {
  player: RecruitingBoardPlayer;
  className?: string;
};

/** Pros, cons, skinny, and evaluator notes — shared across headliner + class overview. */
export function RecruitingEvalSections({ player, className = '' }: Props): React.ReactElement | null {
  const skinny = coerceDisplayText(player.skinny ?? player.profileNote ?? player.notes);
  const evaluatorNotes = coerceDisplayText(player.evaluatorNotes);
  const strengths = (player.strengths ?? []).map((s) => coerceDisplayText(s)).filter(Boolean) as string[];
  const weaknesses = (player.weaknesses ?? []).map((s) => coerceDisplayText(s)).filter(Boolean) as string[];

  if (!skinny && !evaluatorNotes && !strengths.length && !weaknesses.length) return null;

  return (
    <div className={`gv-rh-eval${className ? ` ${className}` : ''}`}>
      {skinny ? (
        <blockquote className="gv-rh-eval__skinny">
          <span className="gv-rh-eval__label">Skinny</span>
          {skinny}
        </blockquote>
      ) : null}
      {strengths.length > 0 ? (
        <div className="gv-rh-eval__block">
          <h4 className="gv-rh-eval__label">Strengths</h4>
          <ul className="gv-rh-eval__list">
            {strengths.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {weaknesses.length > 0 ? (
        <div className="gv-rh-eval__block">
          <h4 className="gv-rh-eval__label">Weaknesses</h4>
          <ul className="gv-rh-eval__list gv-rh-eval__list--cons">
            {weaknesses.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {evaluatorNotes ? (
        <div className="gv-rh-eval__block">
          <h4 className="gv-rh-eval__label">Evaluator Notes</h4>
          <p className="gv-rh-eval__notes">{evaluatorNotes}</p>
        </div>
      ) : null}
    </div>
  );
}

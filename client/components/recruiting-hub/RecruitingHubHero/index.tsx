'use client';

import React from 'react';

type Props = {
  nationalRank?: number | null;
  classScore?: number | null;
  commitCount?: number;
  targetCount?: number;
};

export function RecruitingHubHero({
  nationalRank,
  classScore,
  commitCount = 0,
  targetCount = 0,
}: Props): React.ReactElement {
  return (
    <section className="gv-rh-elite-hero rh-hero" data-testid="rh-elite-hero">
      <div className="rh-hero__bg gv-rh-elite-hero__bg" aria-hidden="true" />
      <div className="gv-rh-elite-hero__inner rh-frame">
        <p className="gv-rh-elite-hero__eyebrow">Florida Recruiting</p>
        <h1 className="gv-rh-elite-hero__title rh-hero__title">Who Florida is chasing</h1>
        <p className="gv-rh-elite-hero__sub rh-hero__subtitle">
          Movement, board, and beat intel — the story of this class.
        </p>
        <div className="gv-rh-elite-hero__stats" aria-label="Class snapshot">
          <div className="gv-rh-elite-stat">
            <span className="gv-rh-elite-stat__label">On3 Class Rank</span>
            <strong className="gv-rh-elite-stat__value">
              {nationalRank != null ? `#${nationalRank}` : '—'}
            </strong>
          </div>
          <div className="gv-rh-elite-stat">
            <span className="gv-rh-elite-stat__label">Class Score</span>
            <strong className="gv-rh-elite-stat__value">
              {classScore != null ? Number(classScore).toFixed(1) : '—'}
            </strong>
          </div>
          <div className="gv-rh-elite-stat">
            <span className="gv-rh-elite-stat__label">2027 Commits</span>
            <strong className="gv-rh-elite-stat__value">{commitCount}</strong>
          </div>
          <div className="gv-rh-elite-stat">
            <span className="gv-rh-elite-stat__label">Priority Targets</span>
            <strong className="gv-rh-elite-stat__value">{targetCount}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}

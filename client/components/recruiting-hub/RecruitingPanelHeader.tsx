'use client';

import React from 'react';

export type RecruitingPanelStat = {
  label: string;
  value: string;
};

type Props = {
  kicker: string;
  title: string;
  dek?: string;
  stats?: RecruitingPanelStat[];
};

/** Navy command header for recruiting panel tabs — kicker, display title, optional stats. */
export function RecruitingPanelHeader({ kicker, title, dek, stats }: Props): React.ReactElement {
  return (
    <header className="gv-rh-elite-hero gv-rh-panel-head" data-testid="rh-panel-head">
      <div className="gv-rh-elite-hero__inner">
        <p className="gv-rh-elite-hero__eyebrow">{kicker}</p>
        <h2 className="gv-rh-elite-hero__title">{title}</h2>
        {dek ? <p className="gv-rh-elite-hero__sub">{dek}</p> : null}
        {stats && stats.length > 0 ? (
          <div className="gv-rh-elite-hero__stats" role="list">
            {stats.map((stat) => (
              <div key={stat.label} className="gv-rh-elite-stat" role="listitem">
                <span className="gv-rh-elite-stat__label">{stat.label}</span>
                <strong className="gv-rh-elite-stat__value">{stat.value}</strong>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}

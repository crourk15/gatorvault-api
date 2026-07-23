'use client';

import React from 'react';
import type { SeasonModelSummary } from '@/lib/schedule-premium';

type Props = {
  model: SeasonModelSummary;
};

export function SeasonModelStrip({ model }: Props): React.ReactElement {
  return (
    <aside className="gv-sched-model" data-testid="schedule-season-model">
      <div className="gv-sched-model__copy">
        <p className="gv-sched-model__eyebrow">War Room model</p>
        <p className="gv-sched-model__line">
          <strong>{model.expectedWins.toFixed(1)} expected wins</strong>
          <span aria-hidden="true"> · </span>
          lean path <strong>{model.modeRecord}</strong>
          <span aria-hidden="true"> · </span>
          base case band 7-5 to 8-4
        </p>
        <p className="gv-sched-model__note">
          Win % is the model. Lean scores follow that probability — underdogs are not shown as wins.
          Full War Room slate (including Oklahoma) still projects about 7.6 expected wins.
        </p>
      </div>
      <a className="gv-sched-model__link" href={model.articleHref}>
        Read the win model
      </a>
    </aside>
  );
}

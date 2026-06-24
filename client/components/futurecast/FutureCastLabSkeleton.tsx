'use client';

import React from 'react';
import { UiWarming } from '@/components/site/UiMessage';

type Props = {
  warming?: boolean;
};

export function FutureCastLabSkeleton({ warming = true }: Props): React.ReactElement {
  return (
    <div className="rh-cc-page fc-lab-cc-page rh-frame" data-testid="fc-elite-loading" aria-busy="true">
      {warming ? <UiWarming hint="Loading master board and movement intel." /> : null}
      <div className="fc-lab-skeleton fc-lab-skeleton--hero" aria-hidden="true" />
      <div className="fc-lab-skeleton__grid" aria-hidden="true">
        <div className="fc-lab-skeleton fc-lab-skeleton--panel fc-lab-skeleton--tall" />
        <div className="fc-lab-skeleton fc-lab-skeleton--panel" />
        <div className="fc-lab-skeleton fc-lab-skeleton--panel" />
        <div className="fc-lab-skeleton fc-lab-skeleton--panel fc-lab-skeleton--tall" />
      </div>
    </div>
  );
}

export function FutureCastPanelSkeleton({ minHeight = 200 }: { minHeight?: number }): React.ReactElement {
  return (
    <div
      className="fc-lab-skeleton fc-lab-skeleton--panel"
      style={{ minHeight }}
      aria-hidden="true"
      data-testid="fc-panel-skeleton"
    />
  );
}

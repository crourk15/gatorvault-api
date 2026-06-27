'use client';

import React from 'react';
import { RECRUITING_TAB_PATHS } from '@/lib/vault-route-map';
import { useFutureCastLabCycle } from './FutureCastLabCycleContext';

type Props = {
  className?: string;
};

export function FutureCastLabCycleToggle({ className }: Props): React.ReactElement {
  const { cycle, setCycle } = useFutureCastLabCycle();

  return (
    <div
      className={`rh-cc-tabs fc-lab-cycle-toggle${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label="FutureCast class cycle"
      data-testid="fc-lab-cycle-toggle"
    >
      <button
        type="button"
        role="tab"
        aria-selected={cycle === 2028}
        className={`rh-cc-tabs__btn${cycle === 2028 ? ' is-active' : ''}`}
        onClick={() => setCycle(2028)}
      >
        2028 Discovery
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={cycle === 2027}
        className={`rh-cc-tabs__btn${cycle === 2027 ? ' is-active' : ''}`}
        onClick={() => setCycle(2027)}
      >
        2027 Closing Class
      </button>
      {cycle === 2027 ? (
        <a href={RECRUITING_TAB_PATHS['targets-2027']} className="rh-cc-link fc-lab-cycle-toggle__hub">
          Recruiting Hub →
        </a>
      ) : (
        <a href={RECRUITING_TAB_PATHS['targets-2028']} className="rh-cc-link fc-lab-cycle-toggle__hub">
          2028 Targets →
        </a>
      )}
    </div>
  );
}

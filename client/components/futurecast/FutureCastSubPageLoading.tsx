'use client';

import React from 'react';

type Props = {
  testId?: string;
};

/** Premium loading skeleton for FutureCast sub-pages. */
export function FutureCastSubPageLoading({ testId = 'fc-subpage-loading' }: Props): React.ReactElement {
  return (
    <div className="rh-cc-page fc-lab-cc-page rh-frame" data-testid={testId} aria-busy="true">
      <div className="rh-cc-skeleton" style={{ minHeight: 200, borderRadius: 12 }} />
      <div className="rh-cc-skeleton" style={{ minHeight: 280, borderRadius: 12, marginTop: 16 }} />
      <div className="rh-cc-skeleton" style={{ minHeight: 160, borderRadius: 12, marginTop: 16 }} />
    </div>
  );
}

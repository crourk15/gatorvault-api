'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
};

/** Premium page content wrapper — use inside FutureCastElitePageShell. */
export function FutureCastPageLayout({ children }: Props): React.ReactElement {
  return (
    <div className="rh-cc-page fc-lab-cc-page" data-testid="fc-page-layout">
      {children}
    </div>
  );
}

'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
};

export function FutureCastPageLayout({ children }: Props): React.ReactElement {
  return (
    <div className="futurecast-page" data-testid="fc-page-layout">
      {children}
    </div>
  );
}

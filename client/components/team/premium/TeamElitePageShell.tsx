'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  testId?: string;
};

export function TeamElitePageShell({ children, testId = 'vault-team' }: Props): React.ReactElement {
  return (
    <div
      className="rh-page rh-page--elite team-premium-page gv-team-page mobile-app gv-page"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

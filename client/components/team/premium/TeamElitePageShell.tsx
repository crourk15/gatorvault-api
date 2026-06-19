'use client';

import React from 'react';
import { useIsCommandCenterDesktop } from '@/hooks/useIsCommandCenterDesktop';

type Props = {
  children: React.ReactNode;
  testId?: string;
};

export function TeamElitePageShell({ children, testId = 'vault-team' }: Props): React.ReactElement {
  const isDesktop = useIsCommandCenterDesktop();

  return (
    <div
      className="rh-page rh-page--elite team-premium-page gv-team-page mobile-app gv-page"
      data-testid={testId}
    >
      {!isDesktop ? (
        <header className="team-premium-mobile-header" aria-label="Team page">
          <span className="team-premium-mobile-header__title">Team Command Center</span>
        </header>
      ) : null}
      {children}
    </div>
  );
}

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
        <header className="rh-elite-mobile-header" aria-label="Team page" data-testid="team-mobile-header">
          <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
          <h1 className="rh-elite-mobile-header__title">Florida Football</h1>
          <p className="rh-elite-mobile-header__sub">Depth chart, roster, and pipeline.</p>
        </header>
      ) : null}
      {children}
    </div>
  );
}

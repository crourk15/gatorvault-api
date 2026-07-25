'use client';

import React from 'react';

/** Recruiting hub page wrapper — hero owns page identity (no redundant mobile title strip). */
export function RecruitingHubPageChrome({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="rh-page rh-page--elite mobile-app" data-testid="vault-recruiting-hub">
      {children}
    </div>
  );
}

'use client';

import React from 'react';

/** Compact mobile header — not the desktop elite hero. */
export function RecruitingHubMobileHeader(): React.ReactElement {
  return (
    <header className="rh-elite-mobile-header" data-testid="rh-mobile-header">
      <h1 className="rh-elite-mobile-header__title">Recruiting Hub</h1>
      <p className="rh-elite-mobile-header__sub">Boards, FutureCast, NIL, Portal</p>
    </header>
  );
}

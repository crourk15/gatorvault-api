'use client';

import React from 'react';

/** Compact mobile header — Florida Recruiting (vertical app). */
export function RecruitingHubMobileHeader(): React.ReactElement {
  return (
    <header className="rh-elite-mobile-header" data-testid="rh-mobile-header">
      <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
      <h1 className="rh-elite-mobile-header__title">Florida Recruiting</h1>
      <p className="rh-elite-mobile-header__sub">
        Who Florida is chasing — movement, board, and beat intel.
      </p>
    </header>
  );
}

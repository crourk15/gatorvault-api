'use client';

import React from 'react';

/** Compact mobile header — UF Recruiting Command Center (vertical app). */
export function RecruitingHubMobileHeader(): React.ReactElement {
  return (
    <header className="rh-elite-mobile-header" data-testid="rh-mobile-header">
      <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
      <h1 className="rh-elite-mobile-header__title">UF Recruiting Hub</h1>
      <p className="rh-elite-mobile-header__sub">
        Live pulse, intel, movement, and boards — one vertical feed.
      </p>
    </header>
  );
}

'use client';

import React from 'react';

/** Compact mobile header — mirrors Recruiting Hub vertical app entry. */
export function FutureCastMobileHeader(): React.ReactElement {
  return (
    <header className="rh-elite-mobile-header" data-testid="fc-mobile-header">
      <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
      <h1 className="rh-elite-mobile-header__title">UF FutureCast Lab</h1>
      <p className="rh-elite-mobile-header__sub">
        Commit likelihood, movement intel, fit scores, and competing schools for UF&apos;s top targets.
      </p>
    </header>
  );
}

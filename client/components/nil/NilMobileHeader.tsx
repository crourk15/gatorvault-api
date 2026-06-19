'use client';

import React from 'react';

export function NilMobileHeader(): React.ReactElement {
  return (
    <header className="rh-elite-mobile-header" data-testid="nil-mobile-header">
      <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
      <h1 className="rh-elite-mobile-header__title">NIL Tracker</h1>
      <p className="rh-elite-mobile-header__sub">
        Real-time NIL movement, valuations, and UF competitive position.
      </p>
    </header>
  );
}

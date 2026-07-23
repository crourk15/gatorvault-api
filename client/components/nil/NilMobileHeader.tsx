'use client';

import React from 'react';

export function NilMobileHeader(): React.ReactElement {
  return (
    <header className="rh-elite-mobile-header" data-testid="nil-mobile-header">
      <p className="rh-elite-mobile-header__eyebrow">GatorVault Insider</p>
      <h1 className="rh-elite-mobile-header__title">NIL Desk</h1>
      <p className="rh-elite-mobile-header__sub">
        School markets, labeled valuations, and UF position — Sideline index.
      </p>
    </header>
  );
}

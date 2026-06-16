'use client';

import React from 'react';

export function HeroCommandBar(): React.ReactElement {
  return (
    <header className="rh-hero" data-testid="rh-premium-hero">
      <div className="rh-hero__bg" aria-hidden="true" />
      <div className="rh-frame">
        <h1 className="rh-hero__title gv-h1">Recruiting Hub</h1>
        <p className="rh-hero__subtitle gv-body-sm">Boards, FutureCast, NIL, Portal — all in one place.</p>
      </div>
    </header>
  );
}

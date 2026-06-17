'use client';

import React from 'react';

export function PageTitleBar(): React.ReactElement {
  return (
    <header className="rh-title-bar rh-container" data-testid="rh-page-title-bar">
      <h1 className="rh-title-bar__title">🐊 Recruiting Hub</h1>
      <p className="rh-title-bar__sub">Boards, FutureCast, NIL, Portal — all in one place.</p>
    </header>
  );
}

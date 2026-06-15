'use client';

import React from 'react';
import { MarketingWelcomePage } from './MarketingWelcomePage';

/** Variant B — Elite Light Mode (UF-blue marketing theme). */
export function WelcomeB(): React.ReactElement {
  return (
    <div className="welcome welcome-bright" data-testid="welcome-page" data-welcome-variant="B">
      <MarketingWelcomePage />
    </div>
  );
}

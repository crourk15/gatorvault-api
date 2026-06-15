'use client';

import React from 'react';
import { MarketingWelcomePage } from './MarketingWelcomePage';

/** Variant B — same premium layout (A/B copy test reserved for future). */
export function WelcomeB(): React.ReactElement {
  return (
    <div className="welcome welcome-premium" data-testid="welcome-page" data-welcome-variant="B">
      <MarketingWelcomePage />
    </div>
  );
}

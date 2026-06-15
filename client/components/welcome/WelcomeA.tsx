'use client';

import React from 'react';
import { MarketingWelcomePage } from './MarketingWelcomePage';

/** Variant A — premium Swamp Night theme. */
export function WelcomeA(): React.ReactElement {
  return (
    <div className="welcome welcome-premium" data-testid="welcome-page" data-welcome-variant="A">
      <MarketingWelcomePage />
    </div>
  );
}

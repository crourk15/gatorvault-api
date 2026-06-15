'use client';

import React from 'react';
import { MarketingWelcomePage } from './MarketingWelcomePage';

/** Variant A — cinematic Swamp Night Elite theme. */
export function WelcomeA(): React.ReactElement {
  return (
    <div className="welcome" data-testid="welcome-page" data-welcome-variant="A">
      <MarketingWelcomePage />
    </div>
  );
}

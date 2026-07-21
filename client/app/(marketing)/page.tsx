'use client';

import React from 'react';
import { MarketingWelcomePage } from '@/components/welcome/MarketingWelcomePage';
import '@/lib/welcome-landing.css';
import '@/lib/pricing-section.css';
import '@/lib/free-vs-insider.css';

/** Elite landing at / — PublicSiteShell from (marketing)/layout.tsx only. */
export default function HomePage(): React.ReactElement {
  return (
    <div className="mobile-app" data-testid="landing-page">
      <MarketingWelcomePage />
    </div>
  );
}

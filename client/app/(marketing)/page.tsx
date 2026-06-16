'use client';

import React from 'react';
import { MarketingWelcomePage } from '@/components/welcome/MarketingWelcomePage';
import '@/lib/gv-design-system.css';
import '@/lib/welcome-landing.css';
import '@/lib/pricing-section.css';
import '@/lib/free-vs-insider.css';
import '@/lib/operator-access.css';
import '@/lib/welcome-mobile.css';

/** Elite landing at / — PublicSiteShell from (marketing)/layout.tsx only. */
export default function HomePage(): React.ReactElement {
  return (
    <div data-testid="landing-page">
      <MarketingWelcomePage />
    </div>
  );
}

'use client';

import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { MarketingWelcomePage } from '@/components/welcome/MarketingWelcomePage';
import '@/lib/gv-design-system.css';
import '@/lib/welcome-landing.css';
import '@/lib/pricing-section.css';
import '@/lib/free-vs-insider.css';
import '@/lib/operator-access.css';
import '@/lib/welcome-mobile.css';

export default function LandingPage(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <MarketingWelcomePage />
    </PublicSiteShell>
  );
}

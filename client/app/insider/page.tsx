'use client';

import React from 'react';
import '@/lib/gv-design-system.css';
import '@/lib/insider-landing.css';
import '@/lib/pricing-section.css';
import '@/lib/welcome-elite.css';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { InsiderLandingPage } from '@/components/insider/InsiderLandingPage';

export default function InsiderRoute(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <InsiderLandingPage />
    </PublicSiteShell>
  );
}

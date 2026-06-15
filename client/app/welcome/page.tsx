'use client';

import React from 'react';
import '@/lib/gv-design-system.css';
import '@/lib/welcome-elite.css';
import '@/lib/welcome-premium.css';
import '@/lib/welcome-hero.css';
import '@/lib/welcome-value-proposition.css';
import '@/lib/welcome-social-proof.css';
import '@/lib/pricing-section.css';
import '@/lib/welcome-mobile.css';
import '@/lib/free-vs-insider.css';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { ABWelcomePage } from '@/components/welcome/ABWelcomePage';

export default function WelcomeRoute(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <ABWelcomePage />
    </PublicSiteShell>
  );
}

'use client';

import React from 'react';
import '@/lib/welcome-elite.css';
import '@/lib/welcome-bright.css';
import '@/lib/welcome-pricing.css';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { ABWelcomePage } from '@/components/welcome/ABWelcomePage';

export default function WelcomeRoute(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <ABWelcomePage />
    </PublicSiteShell>
  );
}

'use client';

import React from 'react';
import '@/lib/welcome-elite.css';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { WelcomePage } from '@/components/welcome/WelcomePage';

export default function WelcomeRoute(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <WelcomePage />
    </PublicSiteShell>
  );
}

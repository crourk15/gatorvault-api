'use client';

import React from 'react';
import { LandingPage } from '@/components/site/LandingPage';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

export default function HomePage(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <LandingPage />
    </PublicSiteShell>
  );
}

'use client';

import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { LandingPage } from '@/components/site/LandingPage';

/** React marketing landing at `/` — Platform Guardian expects data-testid="landing-page". */
export default function HomePage(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <LandingPage />
    </PublicSiteShell>
  );
}

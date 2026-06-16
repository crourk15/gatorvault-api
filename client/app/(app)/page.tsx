'use client';

import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { MarketingWelcomePage } from '@/components/welcome/MarketingWelcomePage';

/** Public marketing landing at /. Vault dashboard lives at /vault. */
export default function HomePage(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <div data-testid="landing-page">
        <MarketingWelcomePage />
      </div>
    </PublicSiteShell>
  );
}

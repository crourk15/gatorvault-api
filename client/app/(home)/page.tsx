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
import '@/lib/operator-access.css';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { MarketingWelcomePage } from '@/components/welcome/MarketingWelcomePage';

/** React marketing landing at `/` — newest hero + layout; Guardian expects data-testid="landing-page". */
export default function HomePage(): React.ReactElement {
  return (
    <PublicSiteShell marketing>
      <div className="welcome welcome-premium" data-testid="landing-page">
        <MarketingWelcomePage />
      </div>
    </PublicSiteShell>
  );
}

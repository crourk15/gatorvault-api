'use client';

import React from 'react';
import { MarketingWelcomePage } from '@/components/welcome/MarketingWelcomePage';
import '@/lib/welcome-landing.css';
import '@/lib/pricing-section.css';
import '@/lib/free-vs-insider.css';

/** Elite landing at /welcome/ — shell from (marketing)/layout.tsx only. */
export default function WelcomePage(): React.ReactElement {
  return <MarketingWelcomePage />;
}

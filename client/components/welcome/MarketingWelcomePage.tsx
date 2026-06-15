'use client';

import React from 'react';
import { WelcomeHero } from './WelcomeHero';
import { PricingSection } from './PricingSection';
import { FreeVsInsider } from './FreeVsInsider';
import { KeyFeatures } from './KeyFeatures';
import { FooterCTA, WelcomeStickyCTA } from './FooterCTA';

/** Shared marketing + conversion layout for /welcome. */
export function MarketingWelcomePage(): React.ReactElement {
  return (
    <>
      <WelcomeHero />
      <PricingSection />
      <FreeVsInsider />
      <KeyFeatures />
      <FooterCTA />
      <WelcomeStickyCTA />
    </>
  );
}

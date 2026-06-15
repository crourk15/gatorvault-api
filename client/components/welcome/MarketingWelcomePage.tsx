'use client';

import React from 'react';
import { WelcomeHero } from './WelcomeHero';
import { ValueProposition } from './ValueProposition';
import { SocialProof } from './SocialProof';
import { PricingSection } from './PricingSection';
import { FreeVsInsider } from './FreeVsInsider';
import { FooterCTA, WelcomeStickyCTA } from './FooterCTA';

/** Premium marketing + conversion layout for /welcome. */
export function MarketingWelcomePage(): React.ReactElement {
  return (
    <>
      <WelcomeHero />
      <ValueProposition />
      <SocialProof />
      <PricingSection />
      <FreeVsInsider />
      <FooterCTA />
      <WelcomeStickyCTA />
    </>
  );
}

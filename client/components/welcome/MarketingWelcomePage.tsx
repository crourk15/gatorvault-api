'use client';

import React from 'react';
import { LandingHeroElite } from './LandingHeroElite';
import { LandingSystemOverview } from './LandingSystemOverview';
import { LandingPreviewStrip } from './LandingPreviewStrip';
import { LandingSocialProofElite } from './LandingSocialProofElite';
import { LandingFinalCTA } from './LandingFinalCTA';
import { PricingSection } from './PricingSection';
import { FreeVsInsider } from './FreeVsInsider';
import { WelcomeStickyCTA } from './FooterCTA';
import { OperatorAccessFooter } from './OperatorAccessFooter';

/** Full elite marketing landing for /welcome/. */
export function MarketingWelcomePage(): React.ReactElement {
  return (
    <>
      <LandingHeroElite />
      <LandingSystemOverview />
      <LandingPreviewStrip />
      <LandingSocialProofElite />
      <PricingSection />
      <FreeVsInsider />
      <LandingFinalCTA />
      <WelcomeStickyCTA />
      <OperatorAccessFooter />
    </>
  );
}

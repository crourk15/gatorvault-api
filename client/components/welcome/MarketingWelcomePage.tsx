'use client';

import React from 'react';
import { LandingHero } from './LandingHero';
import { LandingValueProp } from './LandingValueProp';
import { LandingSocialProof } from './LandingSocialProof';
import { PricingSection } from './PricingSection';
import { FreeVsInsider } from './FreeVsInsider';
import { FooterCTA, WelcomeStickyCTA } from './FooterCTA';
import { OperatorAccessFooter } from './OperatorAccessFooter';

/** Marketing landing composition for /welcome/. */
export function MarketingWelcomePage(): React.ReactElement {
  return (
    <div className="gv-landing-page">
      <LandingHero />
      <LandingValueProp />
      <LandingSocialProof />
      <PricingSection />
      <FreeVsInsider />
      <FooterCTA />
      <WelcomeStickyCTA />
      <OperatorAccessFooter />
    </div>
  );
}

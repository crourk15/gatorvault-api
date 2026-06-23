'use client';

import React from 'react';
import { LandingHeroElite } from './LandingHeroElite';
import { LandingSystemOverview } from './LandingSystemOverview';
import { LandingWhyGatorVault } from './LandingWhyGatorVault';
import { LandingSocialProofElite } from './LandingSocialProofElite';
import { LandingFinalCTA } from './LandingFinalCTA';
import { PricingSection } from './PricingSection';
import { FreeVsInsider } from './FreeVsInsider';
import { WelcomeStickyCTA } from './FooterCTA';
import { OperatorAccessFooter } from './OperatorAccessFooter';
import { LegalSiteLinks } from '@/components/site/LegalSiteLinks';

/** Elite marketing landing — served at / and /welcome/. */
export function MarketingWelcomePage(): React.ReactElement {
  return (
    <>
      <LandingHeroElite />
      <LandingSystemOverview />
      <LandingWhyGatorVault />
      <LandingSocialProofElite />
      <PricingSection />
      <FreeVsInsider />
      <LandingFinalCTA />
      <WelcomeStickyCTA />
      <footer className="gv-marketing-legal-footer">
        <LegalSiteLinks />
      </footer>
      <OperatorAccessFooter />
    </>
  );
}

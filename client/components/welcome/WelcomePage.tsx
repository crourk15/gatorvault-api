'use client';

import React from 'react';
import { HeroSection } from './HeroSection';
import {
  FutureCastPreview,
  RecruitingHubPreview,
  FilmRoomPreview,
  InsiderBenefits,
} from './WelcomePreviewSection';
import { FooterCTA, WelcomeStickyCTA } from './FooterCTA';

export function WelcomePage(): React.ReactElement {
  return (
    <div className="welcome" data-testid="welcome-page">
      <HeroSection />
      <FutureCastPreview />
      <RecruitingHubPreview />
      <FilmRoomPreview />
      <InsiderBenefits />
      <FooterCTA />
      <WelcomeStickyCTA />
    </div>
  );
}

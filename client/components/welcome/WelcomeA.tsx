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
import { InsiderComparisonTable } from '@/components/InsiderComparisonTable';

/** Variant A — cinematic Swamp Night Elite theme. */
export function WelcomeA(): React.ReactElement {
  return (
    <div className="welcome" data-testid="welcome-page" data-welcome-variant="A">
      <HeroSection />
      <FutureCastPreview />
      <RecruitingHubPreview />
      <FilmRoomPreview />
      <InsiderBenefits />
      <InsiderComparisonTable />
      <FooterCTA />
      <WelcomeStickyCTA />
    </div>
  );
}

'use client';

import React from 'react';
import { InsiderHero } from './InsiderHero';
import { WhatYouGet } from './WhatYouGet';
import { FilmRoomPreviewSection } from './FilmRoomPreviewSection';
import { WarRoomPreviewSection } from './WarRoomPreviewSection';
import { PricingSection } from '@/components/welcome/PricingSection';
import { InsiderFAQ } from './InsiderFAQ';
import { FooterCTA } from '@/components/welcome/FooterCTA';

/** Full premium Insider landing page. */
export function InsiderLandingPage(): React.ReactElement {
  return (
    <div className="insider-landing" data-testid="insider-page">
      <InsiderHero />
      <WhatYouGet />
      <FilmRoomPreviewSection />
      <WarRoomPreviewSection />
      <PricingSection />
      <InsiderFAQ />
      <FooterCTA />
    </div>
  );
}

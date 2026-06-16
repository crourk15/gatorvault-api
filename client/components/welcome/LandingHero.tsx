'use client';

import React from 'react';
import { Button } from '@/components/brand';
import { landingContent } from './content';
import { WELCOME_LINKS } from './links';

export function LandingHero(): React.ReactElement {
  const { heroHeadline, heroSubheadline } = landingContent;

  return (
    <section className="gv-landing-hero" data-testid="welcome-hero">
      <div className="gv-landing-container">
        <h1 className="gv-landing-h1">{heroHeadline}</h1>
        <p className="gv-landing-sub">{heroSubheadline}</p>
        <div className="gv-landing-cta-row">
          <Button href={WELCOME_LINKS.join} variant="primary">
            Join GatorVault
          </Button>
          <Button href={WELCOME_LINKS.recruiting} variant="secondary">
            Explore Recruiting
          </Button>
        </div>
      </div>
    </section>
  );
}

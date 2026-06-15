'use client';

import React from 'react';
import Link from 'next/link';
import { welcomeContent } from './content';
import { WELCOME_LINKS } from './links';

/** Conversion hero — headline, subheadline, primary Insider CTA. */
export function WelcomeHero(): React.ReactElement {
  const { title, subtitle } = welcomeContent.hero;

  return (
    <section className="welcome-hero welcome-hero-conversion" data-testid="welcome-hero">
      <div className="welcome-hero-lights" aria-hidden="true" />
      <div className="welcome-hero-mist" aria-hidden="true" />
      <div className="welcome-hero-overlay" aria-hidden="true" />
      <div className="welcome-hero-inner welcome-hero-inner--conversion">
        <div className="welcome-hero-copy welcome-hero-copy--conversion">
          <h1 className="welcome-hero-title">{title}</h1>
          <p className="welcome-hero-subtitle">{subtitle}</p>
          <div className="welcome-hero-cta">
            <Link href={WELCOME_LINKS.insider} className="welcome-cta-primary">
              Become an Insider
            </Link>
            <Link href={WELCOME_LINKS.futurecast} className="welcome-cta-secondary">
              Explore FutureCast
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

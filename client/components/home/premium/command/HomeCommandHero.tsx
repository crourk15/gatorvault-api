'use client';

import React from 'react';

type Props = {
  /** Single live pulse line — not a marquee dump. */
  pulseHeadline: string;
};

export function HomeCommandHero({ pulseHeadline }: Props): React.ReactElement {
  const pulse = pulseHeadline.trim() || 'GatorNation command center — live intel loading…';

  return (
    <section className="home-wow-hero" aria-label="GatorVault home hero" data-testid="home-command-hero">
      <div className="home-wow-hero-sweep" aria-hidden="true" />
      <div className="home-wow-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <h1 className="home-wow-hero-title">Only Gators Get Out Alive.</h1>
      <p className="home-wow-hero-subtitle">UF football. Recruiting. FutureCast. All here.</p>
      <p className="home-wow-hero-meta">Your command center for the GatorNation.</p>
      <span className="home-wow-hero-underline" aria-hidden="true" />
      <p className="home-wow-hero-pulse" data-testid="home-hero-pulse" aria-live="polite">
        <span className="home-wow-hero-pulse__label">Now</span>
        <span className="home-wow-hero-pulse__text">{pulse}</span>
      </p>
    </section>
  );
}

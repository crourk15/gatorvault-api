'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  /** Single live pulse line — not a marquee dump. */
  pulseHeadline: string;
};

export function HomeCommandHero({ pulseHeadline }: Props): React.ReactElement {
  const pulse = pulseHeadline.trim() || 'Live intel loading…';

  return (
    <section className="home-wow-hero" aria-label="GatorVault home hero" data-testid="home-command-hero">
      <div className="home-wow-hero__bg" aria-hidden="true" />
      <div className="home-wow-hero-sweep" aria-hidden="true" />
      <div className="home-wow-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <div className="home-wow-hero__inner">
        <h1 className="home-wow-hero-title">GatorVault</h1>
        <p className="home-wow-hero-slogan">Only Gators Get Out Alive.</p>
        <p className="home-wow-hero-subtitle">UF football. Recruiting. FutureCast. All here.</p>
        <div className="home-wow-hero-ctas" data-testid="home-hero-ctas">
          <a href={VAULT_PILLAR_ROUTES.recruiting} className="home-wow-hero-cta home-wow-hero-cta--primary">
            Recruiting
          </a>
          <a href={VAULT_PILLAR_ROUTES.futurecast} className="home-wow-hero-cta home-wow-hero-cta--primary">
            FutureCast
          </a>
          <a href={VAULT_PILLAR_ROUTES.team} className="home-wow-hero-cta home-wow-hero-cta--secondary">
            Team
          </a>
        </div>
        <span className="home-wow-hero-underline" aria-hidden="true" />
        <p className="home-wow-hero-pulse" data-testid="home-hero-pulse" aria-live="polite">
          <span className="home-wow-hero-pulse__label">Now</span>
          <span className="home-wow-hero-pulse__text">{pulse}</span>
        </p>
      </div>
    </section>
  );
}

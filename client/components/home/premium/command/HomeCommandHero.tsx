'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  /** Kept for API compat — pulse lives below the fold now. */
  pulseHeadline: string;
};

/** Brand-first hero — one headline, one sentence, one CTA group. */
export function HomeCommandHero({ pulseHeadline: _pulseHeadline }: Props): React.ReactElement {
  return (
    <section className="home-wow-hero" aria-label="GatorVault home hero" data-testid="home-command-hero">
      <div className="home-wow-hero__bg" aria-hidden="true" />
      <div className="home-wow-hero-sweep" aria-hidden="true" />
      <div className="home-wow-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <div className="home-wow-hero__inner">
        <h1 className="home-wow-hero-title">GatorVault</h1>
        <p className="home-wow-hero-subtitle">
          Only Gators get out alive — recruiting, FutureCast, team, and GNL in one vault.
        </p>
        <div className="home-wow-hero-ctas" data-testid="home-hero-ctas">
          <a href={VAULT_PILLAR_ROUTES.recruiting} className="home-wow-hero-cta home-wow-hero-cta--primary">
            Recruiting
          </a>
          <a href={VAULT_PILLAR_ROUTES.futurecast} className="home-wow-hero-cta home-wow-hero-cta--primary">
            FutureCast
          </a>
          <a href={VAULT_PILLAR_ROUTES.liveFeed} className="home-wow-hero-cta home-wow-hero-cta--secondary">
            GNL Live
          </a>
        </div>
        <span className="home-wow-hero-underline" aria-hidden="true" />
      </div>
    </section>
  );
}

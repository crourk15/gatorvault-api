'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

export function HomePremiumHero(): React.ReactElement {
  return (
    <section
      className="uf-premium-hero"
      aria-label="GatorVault home hero"
      data-testid="home-premium-hero"
    >
      <div className="uf-premium-hero__bg" aria-hidden="true" />
      <div className="uf-premium-hero__fade" aria-hidden="true" />

      <div className="uf-premium-hero__inner uf-premium-hero__inner--fade-in">
        <span className="uf-premium-hero__accent" aria-hidden="true" />
        <h1 className="uf-premium-hero__title">GatorVault</h1>
        <p className="uf-premium-hero__sub">Only Gators Get Out Alive. UF football. Recruiting. FutureCast.</p>
        <div className="uf-premium-hero__ctas">
          <a href={VAULT_PILLAR_ROUTES.recruiting} className="uf-premium-cta uf-premium-cta--primary">
            Recruiting Hub
          </a>
          <a href={VAULT_PILLAR_ROUTES.futurecast} className="uf-premium-cta uf-premium-cta--primary">
            FutureCast
          </a>
          <a href={VAULT_PILLAR_ROUTES.team} className="uf-premium-cta uf-premium-cta--secondary">
            Team Page
          </a>
        </div>
      </div>
    </section>
  );
}

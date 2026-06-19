'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

export function HomePremiumHero(): React.ReactElement {
  return (
    <section
      className="uf-premium-hero gv-texture-stadium-lights"
      aria-label="GatorVault home hero"
      data-testid="home-premium-hero"
    >
      <div className="uf-premium-hero__bg" aria-hidden="true" />
      <div className="uf-premium-hero__fade" aria-hidden="true" />

      <div className="uf-premium-hero__inner uf-premium-hero__inner--fade-in">
        <span className="uf-premium-hero__accent" aria-hidden="true" />
        <h1 className="uf-premium-hero__title">Only Gators Get Out Alive.</h1>
        <p className="uf-premium-hero__sub">UF football. Recruiting. FutureCast. All here.</p>
        <div className="uf-premium-hero__ctas">
          <a href={VAULT_PILLAR_ROUTES.recruiting} className="uf-premium-cta uf-premium-cta--primary">
            Recruiting Hub
          </a>
          <a href={VAULT_PILLAR_ROUTES.futurecast} className="uf-premium-cta uf-premium-cta--primary">
            FutureCast
          </a>
        </div>
      </div>
    </section>
  );
}

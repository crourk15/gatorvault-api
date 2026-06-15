'use client';

import React from 'react';
import { BRAND_LOGOS } from '@/lib/gatorvault-brand-assets';
import { WELCOME_COPY, WELCOME_LINKS } from '@/lib/welcome-copy';

export function HeroSection(): React.ReactElement {
  const { hero } = WELCOME_COPY;

  return (
    <section className="welcome-hero" data-testid="welcome-hero">
      <div className="welcome-hero-lights" aria-hidden="true" />
      <div className="welcome-hero-mist" aria-hidden="true" />
      <div className="welcome-hero-particles" aria-hidden="true" />
      <div className="welcome-hero-overlay" aria-hidden="true" />

      <div className="welcome-hero-inner">
        <div className="welcome-hero-copy">
          <img
            src={BRAND_LOGOS.wordmark}
            alt="GatorVault"
            className="welcome-hero-logo"
            width={220}
            height={48}
          />
          <span className="welcome-hero-badge">{hero.badge}</span>
          <h1 className="welcome-hero-title">{hero.title}</h1>
          <p className="welcome-hero-subtitle">{hero.subtitle}</p>
          <div className="welcome-hero-cta">
            <a href={WELCOME_LINKS.join} className="welcome-cta-primary">
              {hero.ctaPrimary}
            </a>
            <a href={WELCOME_LINKS.futurecast} className="welcome-cta-secondary">
              {hero.ctaSecondary}
            </a>
          </div>
          <div className="welcome-hero-stats">
            {hero.stats.map((stat) => (
              <span key={stat} className="welcome-stat">
                {stat}
              </span>
            ))}
          </div>
        </div>

        <div className="welcome-hero-preview">
          {hero.preview.map((card) => (
            <a key={card.title} href={card.href} className="welcome-hero-card welcome-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

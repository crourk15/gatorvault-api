'use client';

import React from 'react';
import { BRAND_LOGOS } from '@/lib/gatorvault-brand-assets';
import { welcomeContent } from './content';
import { WELCOME_LINKS, welcomeCardHref } from './links';

export function HeroSection(): React.ReactElement {
  const { badge, title, subtitle, stats, ctas, previewCards } = welcomeContent.hero;

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
          <span className="welcome-hero-badge">{badge}</span>
          <h1 className="welcome-hero-title">{title}</h1>
          <p className="welcome-hero-subtitle">{subtitle}</p>
          <div className="welcome-hero-cta">
            <a href={WELCOME_LINKS.join} className="welcome-cta-primary">
              {ctas.primary}
            </a>
            <a href={WELCOME_LINKS.futurecast} className="welcome-cta-secondary">
              {ctas.secondary}
            </a>
          </div>
          <div className="welcome-hero-stats">
            {stats.map((stat) => (
              <span key={stat} className="welcome-stat">
                {stat}
              </span>
            ))}
          </div>
        </div>

        <div className="welcome-hero-preview">
          {previewCards.map((card) => {
            const href = welcomeCardHref(card.title);
            const className = 'welcome-hero-card welcome-card';
            if (href) {
              return (
                <a key={card.title} href={href} className={className}>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </a>
              );
            }
            return (
              <article key={card.title} className={className}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

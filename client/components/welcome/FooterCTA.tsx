'use client';

import React from 'react';
import { WELCOME_COPY, WELCOME_LINKS } from '@/lib/welcome-copy';

export function FooterCTA(): React.ReactElement {
  const { footer } = WELCOME_COPY;

  return (
    <section className="welcome-footer" data-testid="welcome-footer">
      <div className="welcome-footer-inner">
        <h2>{footer.title}</h2>
        <p>{footer.subtitle}</p>
        <div className="welcome-hero-cta welcome-hero-cta--center">
          <a href={WELCOME_LINKS.join} className="welcome-cta-primary">
            {footer.ctaPrimary}
          </a>
          <a href={WELCOME_LINKS.join} className="welcome-cta-secondary">
            {footer.ctaSecondary}
          </a>
        </div>
      </div>
    </section>
  );
}

export function WelcomeStickyCTA(): React.ReactElement {
  return (
    <a href={WELCOME_LINKS.join} className="welcome-sticky-cta" data-testid="welcome-sticky-cta">
      {WELCOME_COPY.sticky}
    </a>
  );
}

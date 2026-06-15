'use client';

import React from 'react';
import { welcomeContent } from './content';
import { WELCOME_LINKS } from './links';

export function FooterCTA(): React.ReactElement {
  const { title, subtitle, ctas } = welcomeContent.sections.footer;

  return (
    <section className="welcome-footer" data-testid="welcome-footer">
      <div className="welcome-footer-inner">
        <h2>{title}</h2>
        <p>{subtitle}</p>
        <div className="welcome-hero-cta welcome-hero-cta--center">
          <a href={WELCOME_LINKS.join} className="welcome-cta-primary">
            {ctas.primary}
          </a>
          <a href={WELCOME_LINKS.join} className="welcome-cta-secondary">
            {ctas.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}

export function WelcomeStickyCTA(): React.ReactElement {
  return (
    <a href={WELCOME_LINKS.join} className="welcome-sticky-cta" data-testid="welcome-sticky-cta">
      {welcomeContent.sections.footer.sticky}
    </a>
  );
}

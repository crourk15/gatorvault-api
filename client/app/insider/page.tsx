'use client';

import React from 'react';
import '@/lib/welcome-elite.css';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';
import { InsiderBenefits } from '@/components/welcome/WelcomePreviewSection';
import { FooterCTA } from '@/components/welcome/FooterCTA';
import { InsiderComparisonTable } from '@/components/InsiderComparisonTable';
import { WELCOME_LINKS } from '@/components/welcome/links';
import { welcomeContent } from '@/components/welcome/content';

export default function InsiderRoute(): React.ReactElement {
  const { title, subtitle } = welcomeContent.sections.insider;

  return (
    <PublicSiteShell marketing>
      <div className="welcome" data-testid="insider-page">
        <section className="welcome-hero welcome-insider-hero">
          <div className="welcome-hero-overlay" aria-hidden="true" />
          <div className="welcome-hero-inner welcome-insider-hero__inner">
            <div className="welcome-hero-copy">
              <h1 className="welcome-hero-title">{title}</h1>
              <p className="welcome-hero-subtitle">{subtitle}</p>
              <div className="welcome-hero-cta">
                <a href={WELCOME_LINKS.join} className="welcome-cta-primary">
                  Become an Insider
                </a>
                <a href="/welcome" className="welcome-cta-secondary">
                  See the Welcome Tour
                </a>
              </div>
            </div>
          </div>
        </section>
        <InsiderBenefits />
        <InsiderComparisonTable />
        <FooterCTA />
      </div>
    </PublicSiteShell>
  );
}

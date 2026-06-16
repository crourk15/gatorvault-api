'use client';

import React from 'react';
import { Button, Card } from '@/components/brand';
import { ProbabilityGauge } from '@/components/ui/ProbabilityGauge';
import { Ticker } from '@/components/ui/Ticker';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { WELCOME_LINKS } from './links';

export function LandingHeroElite(): React.ReactElement {
  return (
    <section className="gv-hero-elite" data-testid="welcome-hero">
      <div className="gv-hero-container">
        <div className="gv-hero-left">
          <h1 className="gv-hero-title">Built for Gator Nation.</h1>
          <p className="gv-hero-sub">
            Verified intel. Real-time updates. Elite recruiting tools for Florida fans who refuse to guess.
          </p>
          <div className="gv-hero-cta-row">
            <Button href={WELCOME_LINKS.join} variant="primary">
              Join GatorVault
            </Button>
            <Button href={WELCOME_LINKS.recruiting} variant="secondary">
              Explore Recruiting
            </Button>
          </div>
          <p className="gv-hero-micro">Cancel anytime. Instant access.</p>
        </div>

        <div className="gv-hero-right">
          <Card variant="dark" className="gv-hero-preview-card">
            <h3 className="gv-hero-preview-title">FutureCast</h3>
            <ProbabilityGauge value={72} label="UF Probability" />
          </Card>
          <Card variant="dark" className="gv-hero-preview-card">
            <h3 className="gv-hero-preview-title">Recruiting Board</h3>
            <FeatureCard
              icon="📈"
              title="4★ ATH — Trending UF"
              description="Movement: +12% | Fit Score: 89"
              className="gv-hero-feature-card"
            />
          </Card>
          <Card variant="dark" className="gv-hero-preview-card">
            <h3 className="gv-hero-preview-title">Gator Nation Live</h3>
            <Ticker
              items={[
                'Portal update coming at 6 PM',
                'UF trending for 2026 WR',
                'Film Room drop tonight',
              ]}
            />
          </Card>
        </div>
      </div>
    </section>
  );
}

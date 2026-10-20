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
          <h1 className="gv-hero-title">Every Florida recruiting storyline. One place.</h1>
          <p className="gv-hero-sub">
            The board, the visits, Game Week, and the film — built by Florida fans who follow the
            class as closely as you do.
          </p>
          <div className="gv-hero-cta-row">
            <Button href={WELCOME_LINKS.join} variant="primary">
              Join GatorVault
            </Button>
            <Button href={WELCOME_LINKS.recruiting} variant="secondary">
              Explore the board
            </Button>
          </div>
          <p className="gv-hero-trust">
            30-day free trial, no card required. We&apos;re fans too — just trying to make sense of
            the class together.
          </p>
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
              title="2028 board"
              description="Targets, visits, and movement in one place"
              className="gv-hero-feature-card"
            />
          </Card>
          <Card variant="dark" className="gv-hero-preview-card">
            <h3 className="gv-hero-preview-title">What&apos;s inside</h3>
            <Ticker items={['Recruiting board', 'FutureCast', 'Game Week', 'Film Room']} />
          </Card>
        </div>
      </div>
    </section>
  );
}

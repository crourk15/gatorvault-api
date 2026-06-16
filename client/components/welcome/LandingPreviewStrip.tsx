'use client';

import React from 'react';
import { Card } from '@/components/brand';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { MediaCardDS } from '@/components/ui/MediaCardDS';

export function LandingPreviewStrip(): React.ReactElement {
  return (
    <section className="gv-preview-strip" data-testid="welcome-preview-strip">
      <div className="gv-preview-container">
        <h2 className="gv-preview-title">Inside the Vault</h2>
        <p className="gv-preview-sub">See what you get before you join.</p>
        <div className="gv-preview-row">
          <Card variant="dark" className="gv-preview-card">
            <FeatureCard
              icon="📊"
              title="FutureCast"
              description="UF probability, Fit Score, predictor movement"
              className="gv-preview-feature"
            />
          </Card>
          <Card variant="dark" className="gv-preview-card">
            <FeatureCard
              icon="🎯"
              title="Recruiting Hub"
              description="Priority board, movement intel, portal tracker"
              className="gv-preview-feature"
            />
          </Card>
          <Card variant="dark" className="gv-preview-card gv-preview-card--media">
            <MediaCardDS
              title="Gator Nation Live"
              subtitle="Daily shows + instant reactions"
              imageUrl="/images/podcasts/gators-breakdown.png"
              imageFallback="/images/podcasts/default.svg"
              className="gv-preview-media"
              testId="welcome-gnl-preview"
            />
          </Card>
        </div>
      </div>
    </section>
  );
}

'use client';

import React from 'react';
import { Card } from '@/components/brand';
import { landingContent } from './content';

const FEATURES = [
  { key: 'recruiting', title: 'Recruiting' },
  { key: 'futurecast', title: 'FutureCast' },
  { key: 'gnl', title: 'Gator Nation Live' },
  { key: 'filmroom', title: 'Film Room' },
] as const;

export function LandingValueProp(): React.ReactElement {
  const { features } = landingContent;

  return (
    <section className="gv-landing-value" data-testid="welcome-value-proposition">
      <div className="gv-landing-container">
        <h2 className="gv-landing-h2">Everything Florida fans care about</h2>
        <div className="gv-landing-grid">
          {FEATURES.map(({ key, title }) => (
            <Card key={key} variant="light">
              <h3 className="gv-landing-card-title">{title}</h3>
              <p className="gv-landing-card-body">{features[key]}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

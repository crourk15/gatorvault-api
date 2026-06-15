'use client';

import React from 'react';
import { LANDING_FEATURES } from '@/lib/pricing-tiers';

/** Optional feature highlights below pricing/comparison. */
export function KeyFeatures(): React.ReactElement {
  return (
    <section className="welcome-key-features" data-testid="welcome-key-features">
      <h2 className="welcome-key-features__title">Built for Gator Nation</h2>
      <div className="welcome-key-features__grid">
        {LANDING_FEATURES.slice(0, 3).map((feature) => (
          <a key={feature.title} href={feature.href} className="welcome-key-features__card">
            <span className="welcome-key-features__icon" aria-hidden="true">
              {feature.icon}
            </span>
            <h3>{feature.title}</h3>
            <p>{feature.desc}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

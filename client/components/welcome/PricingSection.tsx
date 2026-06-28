'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/pricing-section.css';
import { formatMonthlyPrice, publicPricingTiers } from '@/lib/pricing-tiers';

export function PricingSection(): React.ReactElement {
  const tiers = publicPricingTiers();

  return (
    <section className="pricing-section" id="pricing" data-testid="welcome-pricing">
      <h2>Choose Your Plan</h2>
      <p className="pricing-subtitle">
        Two plans built for how Gator fans follow recruiting. 30-day free trial — no card required.
      </p>
      <div className="pricing-grid pricing-grid--duo">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`pricing-card${tier.popular ? ' popular gv-pricing-tier--featured' : ''}`}
          >
            {tier.popular ? <div className="popular-badge">Most Popular</div> : null}
            <h3>
              {tier.icon} {tier.name}
            </h3>
            <p className="price">{formatMonthlyPrice(tier.monthly)}</p>
            <ul>
              {tier.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <Link href={`/join?tier=${tier.id}`} className="pricing-cta">
              Join Now
            </Link>
            <p className="pricing-micro">Cancel anytime</p>
            <p className="pricing-micro">Instant access to Vault</p>
          </div>
        ))}
      </div>
    </section>
  );
}

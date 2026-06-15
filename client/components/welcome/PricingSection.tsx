'use client';

import React from 'react';
import Link from 'next/link';
import { PRICING_TIERS, type PricingTier } from '@/lib/pricing-tiers';
import { WELCOME_LINKS } from '@/components/welcome/links';

const WELCOME_TIER_FEATURES: Record<PricingTier['id'], string[]> = {
  locker: ['Recruiting Hub', 'Live Feed', 'Directory Access'],
  film: ['Everything in Locker Room', 'Film Room Breakdown', 'Advanced Player Profiles'],
  war: ['Everything in Film Room', 'Insider Intel', 'War Room Chat', 'NIL + Portal Tracker (full)'],
};

export function PricingSection(): React.ReactElement {
  return (
    <section className="welcome-pricing" id="pricing" data-testid="welcome-pricing">
      <div className="welcome-pricing__inner">
        <h2 className="welcome-pricing__title">Choose Your Plan</h2>
        <p className="welcome-pricing__subtitle">Simple pricing. Cancel anytime.</p>
        <div className="welcome-pricing__grid">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.id}
              className={`welcome-pricing__card${tier.popular ? ' welcome-pricing__card--popular' : ''}`}
            >
              {tier.popular ? (
                <span className="welcome-pricing__badge">Most Popular</span>
              ) : null}
              <h3 className="welcome-pricing__name">
                {tier.icon} {tier.name}
              </h3>
              <p className="welcome-pricing__price">${tier.monthly.toFixed(2)} / month</p>
              <ul className="welcome-pricing__features">
                {(WELCOME_TIER_FEATURES[tier.id] ?? tier.features).map((feature) => (
                  <li key={feature}>✓ {feature}</li>
                ))}
              </ul>
              <Link href={WELCOME_LINKS.insider} className="welcome-pricing__cta">
                Join Now
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

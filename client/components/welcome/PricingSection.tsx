'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/pricing-section.css';

const TIERS = [
  {
    name: 'Locker Room',
    price: '$4.99 / month',
    features: [
      'Recruiting Hub',
      'Live Feed (read-only)',
      'Directory Access',
      'Basic Player Profiles',
    ],
    popular: false,
  },
  {
    name: 'Film Room',
    price: '$9.99 / month',
    features: [
      'Everything in Locker Room',
      'Film Room Breakdowns',
      'Advanced Player Profiles',
      'FutureCast Predictions',
    ],
    popular: true,
  },
  {
    name: 'War Room',
    price: '$19.99 / month',
    features: [
      'Everything in Film Room',
      'Insider Intel',
      'War Room Chat',
      'NIL + Portal Tracker (full)',
    ],
    popular: false,
  },
] as const;

export function PricingSection(): React.ReactElement {
  return (
    <section className="pricing-section" id="pricing" data-testid="welcome-pricing">
      <h2>Choose Your Plan</h2>
      <p className="pricing-subtitle">Simple pricing. Cancel anytime.</p>
      <div className="pricing-grid">
        {TIERS.map((tier) => (
          <div key={tier.name} className={`pricing-card${tier.popular ? ' popular' : ''}`}>
            {tier.popular ? <div className="popular-badge">Most Popular</div> : null}
            <h3>{tier.name}</h3>
            <p className="price">{tier.price}</p>
            <ul>
              {tier.features.map((feature) => (
                <li key={feature}>✓ {feature}</li>
              ))}
            </ul>
            <Link href="/insider" className="pricing-cta">
              Join Now
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

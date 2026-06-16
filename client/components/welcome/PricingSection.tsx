'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/pricing-section.css';

const TIERS = [
  {
    id: 'locker' as const,
    name: 'Locker Room',
    price: '$4.99 / month',
    features: [
      'Recruiting Hub',
      'Live Feed (read-only)',
      'Directory Access',
      'Basic Player Profiles',
    ],
    featured: false,
  },
  {
    id: 'film' as const,
    name: 'Film Room',
    price: '$9.99 / month',
    features: [
      'Everything in Locker Room',
      'Film Room Breakdowns',
      'Advanced Player Profiles',
      'FutureCast Predictions',
    ],
    featured: true,
  },
  {
    id: 'war' as const,
    name: 'War Room',
    price: '$19.99 / month',
    features: [
      'Everything in Film Room',
      'Insider Intel',
      'War Room Chat',
      'NIL + Portal Tracker (full)',
    ],
    featured: false,
  },
] as const;

export function PricingSection(): React.ReactElement {
  return (
    <section className="pricing-section" id="pricing" data-testid="welcome-pricing">
      <h2>Choose Your Plan</h2>
      <p className="pricing-subtitle">Simple pricing. Cancel anytime.</p>
      <div className="pricing-grid">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`pricing-card${tier.featured ? ' popular gv-pricing-tier--featured' : ''}`}
          >
            {tier.featured ? <div className="popular-badge">Most Popular</div> : null}
            <h3>{tier.name}</h3>
            <p className="price">{tier.price}</p>
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

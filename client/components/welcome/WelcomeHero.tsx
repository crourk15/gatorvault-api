'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/welcome-hero.css';
import { WELCOME_LINKS } from './links';

const TICKER_ITEMS = [
  'FutureCast Elite',
  'Portal Intel',
  'Recruiting Board',
  'Film Room',
  'Insider Notes',
  'Live Feed',
  'Movement Intel',
  'Depth Chart',
];

function HeroTicker(): React.ReactElement {
  const line = [...TICKER_ITEMS, ...TICKER_ITEMS].join(' • ');

  return (
    <div className="welcome-hero-premium__ticker" aria-hidden="true">
      <div className="welcome-hero-premium__ticker-track">{line}</div>
    </div>
  );
}

export function WelcomeHero(): React.ReactElement {
  return (
    <section className="welcome-hero-premium" data-testid="welcome-hero">
      <div className="welcome-hero-premium__gradient" aria-hidden="true" />
      <div className="welcome-hero-premium__bloom" aria-hidden="true" />
      <div className="welcome-hero-premium__mist" aria-hidden="true" />
      <div className="welcome-hero-premium__lights" aria-hidden="true" />
      <div className="welcome-hero-premium__scales" aria-hidden="true" />
      <div className="welcome-hero-premium__motion" aria-hidden="true" />
      <HeroTicker />
      <div className="welcome-hero-premium__content">
        <h1 className="welcome-hero-premium__headline">The Home of Florida Recruiting Intel</h1>
        <p className="welcome-hero-premium__subheadline">Built for Gator Nation.</p>
        <div className="welcome-hero-premium__actions">
          <Link href={WELCOME_LINKS.insider} className="gv-ds-btn gv-ds-btn--primary">
            Become an Insider
          </Link>
          <Link href={WELCOME_LINKS.join} className="gv-ds-btn gv-ds-btn--secondary">
            Start Free
          </Link>
        </div>
      </div>
    </section>
  );
}

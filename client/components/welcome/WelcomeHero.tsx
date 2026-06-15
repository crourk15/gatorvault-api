'use client';

import React from 'react';
import Link from 'next/link';
import '@/lib/welcome-hero.css';

export function WelcomeHero(): React.ReactElement {
  return (
    <section className="welcome-hero-marketing" data-testid="welcome-hero">
      <div className="welcome-hero-content">
        <h1>Welcome to GatorVault</h1>
        <p>Your home for Gators recruiting, intel, film, and insider access.</p>
        <Link href="/insider" className="welcome-cta">
          Become an Insider
        </Link>
      </div>
    </section>
  );
}

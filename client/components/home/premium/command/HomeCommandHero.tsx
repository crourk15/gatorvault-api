'use client';

import React from 'react';

export function HomeCommandHero(): React.ReactElement {
  return (
    <section className="home-hero" aria-label="GatorVault home hero" data-testid="home-command-hero">
      <h1 className="home-hero-title">Only Gators Get Out Alive.</h1>
      <p className="home-hero-subtitle">UF football. Recruiting. FutureCast. All here.</p>
      <p className="home-hero-meta">Your command center for the GatorNation.</p>
    </section>
  );
}

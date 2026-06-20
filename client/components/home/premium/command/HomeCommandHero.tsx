'use client';

import React from 'react';

type Props = {
  tickerItems: string[];
};

export function HomeCommandHero({ tickerItems }: Props): React.ReactElement {
  const items = tickerItems.length > 0 ? tickerItems : ['GatorNation command center loading live intel…'];

  return (
    <section className="home-wow-hero" aria-label="GatorVault home hero" data-testid="home-command-hero">
      <div className="home-wow-hero-sweep" aria-hidden="true" />
      <div className="home-wow-hero-watermark" aria-hidden="true">
        GATORS
      </div>
      <h1 className="home-wow-hero-title">Only Gators Get Out Alive.</h1>
      <p className="home-wow-hero-subtitle">UF football. Recruiting. FutureCast. All here.</p>
      <p className="home-wow-hero-meta">Your command center for the GatorNation.</p>
      <span className="home-wow-hero-underline" aria-hidden="true" />
      <div className="home-wow-hero-ticker" aria-label="Live intel ticker">
        <div className="home-wow-hero-ticker-track">
          {items.map((item, idx) => (
            <span key={idx} className="home-wow-hero-ticker-item">
              {item}
              <span className="home-wow-hero-ticker-sep">·</span>
            </span>
          ))}
          {items.map((item, idx) => (
            <span key={`dup-${idx}`} className="home-wow-hero-ticker-item">
              {item}
              <span className="home-wow-hero-ticker-sep">·</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

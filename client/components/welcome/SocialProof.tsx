'use client';

import React from 'react';

const PILLARS = [
  {
    title: 'Verified Recruiting Intel',
    description:
      'Real updates from beat writers, insiders, and trusted sources — not message board noise or recycled rumors.',
  },
  {
    title: 'Data-Driven Tools',
    description:
      'FutureCast, Movement Intel, Recruiting Hub, Depth Chart, and Film Room — built to give fans clarity, not confusion.',
  },
  {
    title: 'One Unified Platform',
    description:
      'News, rankings, commits, film, podcasts, and live updates — finally together in one clean, premium experience.',
  },
] as const;

export function SocialProof(): React.ReactElement {
  return (
    <section className="welcome-social welcome-premium-section" data-testid="welcome-social-proof">
      <div className="welcome-premium-section__inner welcome-social__inner">
        <div className="welcome-social__pillars" aria-label="Why GatorVault">
          {PILLARS.map((pillar) => (
            <article key={pillar.title} className="welcome-social__pillar gv-premium-card">
              <h3 className="welcome-social__pillar-title">{pillar.title}</h3>
              <p className="welcome-social__pillar-desc">{pillar.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

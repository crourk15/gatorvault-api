'use client';

import React from 'react';
import '@/lib/welcome-social-proof.css';

const BADGES = [
  { label: 'X / Twitter', icon: '𝕏' },
  { label: 'YouTube', icon: '▶' },
  { label: 'Podcasts', icon: '🎙️' },
] as const;

export function SocialProof(): React.ReactElement {
  return (
    <section className="welcome-social welcome-premium-section" data-testid="welcome-social-proof">
      <div className="welcome-premium-section__inner welcome-social__inner">
        <p className="welcome-social__quote">
          Trusted by <strong>10,000+</strong> Gators fans and insiders.
        </p>
        <div className="welcome-social__badges" aria-label="Community channels">
          {BADGES.map((badge) => (
            <span key={badge.label} className="welcome-social__badge gv-premium-card">
              <span className="welcome-social__badge-icon" aria-hidden="true">
                {badge.icon}
              </span>
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

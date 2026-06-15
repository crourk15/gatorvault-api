'use client';

import React from 'react';
import '@/lib/welcome-value-proposition.css';

const CARDS = [
  {
    icon: '📈',
    title: 'FutureCast',
    description: 'Predictive recruiting intel, movement heatmaps, and insider-verified UF probability.',
    href: '/vault/futurecast',
  },
  {
    icon: '📋',
    title: 'Interactive Depth Chart',
    description: 'Clickable position cards with battle status, updated weekly for every unit.',
    href: '/vault/depth-chart',
  },
  {
    icon: '🎯',
    title: 'Recruiting Board',
    description: 'Priority tiers, staff notes, portal tracker, and class rankings in one hub.',
    href: '/vault/recruiting/board',
  },
] as const;

export function ValueProposition(): React.ReactElement {
  return (
    <section className="welcome-value welcome-premium-section" data-testid="welcome-value-proposition">
      <div className="welcome-premium-section__inner">
        <h2 className="welcome-premium-section__title">Built for Gator Nation</h2>
        <p className="welcome-premium-section__subtitle">
          Premium tools for the most dedicated Florida fans — data-driven, insider-ready, and always on.
        </p>
        <div className="welcome-value__grid">
          {CARDS.map((card, index) => (
            <a
              key={card.title}
              href={card.href}
              className="welcome-value__card gv-premium-card"
              style={{ animationDelay: `${0.1 + index * 0.1}s` }}
            >
              <span className="welcome-value__icon" aria-hidden="true">
                {card.icon}
              </span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

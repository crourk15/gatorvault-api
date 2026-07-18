'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

const STRIP_ITEMS = [
  {
    icon: '⚡',
    title: 'GatorNation Live',
    body: 'Jump into the real-time UF football pulse.',
    href: VAULT_PILLAR_ROUTES.liveFeed,
    label: 'Open GNL →',
  },
  {
    icon: '⭐',
    title: 'Recruiting Command Center',
    body: 'Class rankings, movement, and battles in one view.',
    href: VAULT_PILLAR_ROUTES.recruiting,
    label: 'Open Recruiting →',
  },
  {
    icon: '📡',
    title: 'FutureCast Lab',
    body: 'Commit likelihoods, fit scores, and battles.',
    href: VAULT_PILLAR_ROUTES.futurecast,
    label: 'Open FutureCast →',
  },
] as const;

export function HomeCommandLiveStrip(): React.ReactElement {
  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">GatorNation Command Strip</h2>
        <p className="home-wow-section-subtitle">Live, recruiting, and FutureCast—one tap away.</p>
      </div>
      <section className="home-wow-strip-grid" data-testid="home-command-strip">
        {STRIP_ITEMS.map((item) => (
          <a key={item.title} href={item.href} className="home-wow-strip-tile">
            <span className="home-wow-strip-glow" aria-hidden="true" />
            <span className="home-wow-strip-icon" aria-hidden="true">
              {item.icon}
            </span>
            <h3 className="home-wow-strip-title">{item.title}</h3>
            <p className="home-wow-strip-body">{item.body}</p>
            <span className="home-wow-strip-link">{item.label}</span>
          </a>
        ))}
      </section>
    </>
  );
}

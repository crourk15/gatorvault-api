'use client';

import React from 'react';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';
import { SITE_ROUTES } from '@/lib/site-routes';

const STRIP_ITEMS = [
  {
    title: 'GatorNation Live',
    body: 'Jump into the real-time UF football pulse.',
    href: SITE_ROUTES.gatorNationLive,
    label: 'Open GNL →',
  },
  {
    title: 'Recruiting Command Center',
    body: 'Class rankings, movement, and battles in one view.',
    href: VAULT_PILLAR_ROUTES.recruiting,
    label: 'Open Recruiting →',
  },
  {
    title: 'FutureCast Lab',
    body: 'Commit likelihoods, fit scores, and battles.',
    href: VAULT_PILLAR_ROUTES.futurecast,
    label: 'Open FutureCast →',
  },
] as const;

export function HomeCommandLiveStrip(): React.ReactElement {
  return (
    <>
      <div className="home-section-header">
        <h2 className="home-section-title">GatorNation Command Strip</h2>
        <p className="home-section-subtitle">Live, recruiting, and FutureCast—one tap away.</p>
      </div>
      <section className="home-strip-grid" data-testid="home-command-strip">
        {STRIP_ITEMS.map((item) => (
          <article key={item.title} className="home-card">
            <h3 className="home-strip-title">{item.title}</h3>
            <p className="home-strip-body">{item.body}</p>
            <a href={item.href} className="home-strip-link">
              {item.label}
            </a>
          </article>
        ))}
      </section>
    </>
  );
}

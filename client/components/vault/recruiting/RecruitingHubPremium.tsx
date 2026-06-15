'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui';

export function RecruitingHubPremiumHero(): React.ReactElement {
  return (
    <section className="gv-rh-premium-hero gv-rh-hub__frame" data-testid="rh-premium-hero">
      <div className="gv-rh-premium-hero__bg" aria-hidden="true" />
      <div className="gv-rh-premium-hero__lights" aria-hidden="true" />
      <div className="gv-rh-premium-hero__inner">
        <h1 className="gv-rh-premium-hero__title">Recruiting Hub</h1>
        <p className="gv-rh-premium-hero__sub">
          Boards, FutureCast, NIL, Portal — all in one place.
        </p>
        <div className="gv-rh-premium-hero__cta">
          <Button href="/recruiting-board" variant="primary">
            View Recruiting Board
          </Button>
        </div>
      </div>
    </section>
  );
}

const MODULES = [
  {
    icon: '🎯',
    title: 'Recruiting Board',
    description: 'Priority tiers, staff notes, and live board updates.',
    href: '/recruiting-board',
  },
  {
    icon: '📈',
    title: 'FutureCast',
    description: 'UF probability, Fit Score, and movement intel.',
    href: '/vault/futurecast',
  },
  {
    icon: '🔄',
    title: 'Portal Tracker',
    description: 'Incoming and outgoing portal movement with status tags.',
    href: '/vault/portal',
  },
  {
    icon: '💰',
    title: 'NIL Tracker',
    description: 'Deals, valuations, and NIL trends for UF targets.',
    href: '/vault/nil',
  },
] as const;

export function RecruitingHubModules(): React.ReactElement {
  return (
    <section className="gv-rh-modules gv-rh-hub__frame" data-testid="rh-modules">
      <div className="gv-rh-modules__grid">
        {MODULES.map((mod) => (
          <Link key={mod.title} href={mod.href} className="gv-ds-card gv-rh-module">
            <span className="gv-rh-module__icon" aria-hidden="true">
              {mod.icon}
            </span>
            <h3 className="gv-rh-module__title">{mod.title}</h3>
            <p className="gv-rh-module__desc">{mod.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

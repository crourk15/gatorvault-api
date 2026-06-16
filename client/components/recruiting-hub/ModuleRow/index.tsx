'use client';

import React from 'react';
import { ModuleCard } from './ModuleCard';

const MODULES = [
  {
    title: 'Recruiting Board',
    description: 'Priority tiers, staff notes, and live board updates.',
    href: '/vault/recruiting/board',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5h16v2H4V5zm0 6h10v2H4v-2zm0 6h14v2H4v-2z" />
      </svg>
    ),
  },
  {
    title: 'FutureCast',
    description: 'UF probability, Fit Score, and movement intel.',
    href: '/vault/futurecast',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18V6l8-3 8 3v12l-8 3-8-3zm2-1.2 6 2.25 6-2.25V8.3l-6 2.25-6-2.25v8.5z" />
      </svg>
    ),
  },
  {
    title: 'Portal Tracker',
    description: 'Incoming and outgoing portal movement with status tags.',
    href: '/vault/recruiting?tab=portal',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7h10v2H7V7zm-2 4h14v2H5v-2zm2 4h10v2H7v-2z" />
      </svg>
    ),
  },
  {
    title: 'NIL Tracker',
    description: 'Deals, valuations, and NIL trends for UF targets.',
    href: '/vault/nil',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 3 21h18L12 3zm0 4.5L17.2 19H6.8L12 7.5z" />
      </svg>
    ),
  },
] as const;

export function ModuleRow(): React.ReactElement {
  return (
    <section className="rh-module-row rh-frame" data-testid="rh-modules">
      <div className="rh-module-row__grid">
        {MODULES.map((mod) => (
          <ModuleCard key={mod.title} {...mod} />
        ))}
      </div>
    </section>
  );
}

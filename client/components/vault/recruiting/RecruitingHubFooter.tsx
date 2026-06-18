'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';

const LINKS = [
  { href: '/vault/futurecast', label: 'FutureCast' },
  { href: '/vault/futurecast#movement', label: 'Movement Intel' },
  { href: '/vault/recruiting/scouting', label: 'Scouting' },
  { href: '/vault/recruiting/portal', label: 'Portal' },
  { href: '/vault/recruiting/rankings', label: 'Rankings' },
];

export function RecruitingHubFooter(): React.ReactElement {
  return (
    <footer className="gv-rh-footer" aria-label="Florida Recruiting Resources">
      <div className="gv-rh-hub__frame">
        <h2 className="gv-rh-footer__title">Florida Recruiting Resources</h2>
        <nav className="gv-rh-footer__links" aria-label="Recruiting links">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <GatorVaultWordmark height={24} className="gv-rh-footer__wordmark" />
      </div>
    </footer>
  );
}

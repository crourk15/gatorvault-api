'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { GNL_COPY } from '@/lib/gatornation-live-types';

const LINKS = [
  { href: '#podcast-hub', label: 'Podcasts' },
  { href: '/vault/recruiting', label: 'Recruiting Hub' },
  { href: '/vault/futurecast#movement', label: 'Movement Intel' },
  { href: '/vault/recruiting/?tab=portal', label: 'Portal' },
];

export function LiveFooter(): React.ReactElement {
  return (
    <footer className="gv-gnl-footer" aria-label="GatorNation Live resources">
      <div className="gv-gnl__frame">
        <h2 className="gv-gnl-footer__title">{GNL_COPY.footer.title}</h2>
        <nav className="gv-gnl-footer__links" aria-label="GatorNation Live links">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
            </a>
          ))}
        </nav>
        <p className="gv-gnl-footer__tagline">{GNL_COPY.footer.tagline}</p>
        <GatorVaultWordmark height={22} className="gv-gnl-footer__wordmark" />
      </div>
    </footer>
  );
}

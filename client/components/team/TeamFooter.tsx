'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { TEAM_COPY } from '@/lib/team-hub-types';

export function TeamFooter(): React.ReactElement {
  return (
    <footer className="gv-team-footer gv-team__frame" aria-label="Team resources">
      <h2 className="gv-team-footer__title">{TEAM_COPY.footer.title}</h2>
      <nav className="gv-team-footer__links" aria-label="Team section links">
        {TEAM_COPY.footer.links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <GatorVaultWordmark height={22} className="gv-team-footer__wordmark" />
    </footer>
  );
}

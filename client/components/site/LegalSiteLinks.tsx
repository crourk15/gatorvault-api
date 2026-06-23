import React from 'react';
import { LEGAL_ROUTES } from '@/lib/legal-content';

export function LegalSiteLinks({
  className = 'gv-legal-links',
}: {
  className?: string;
}): React.ReactElement {
  return (
    <nav className={className} aria-label="Legal">
      <a href={LEGAL_ROUTES.privacy}>Privacy</a>
      <a href={LEGAL_ROUTES.terms}>Terms</a>
    </nav>
  );
}

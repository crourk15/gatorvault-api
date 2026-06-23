import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}

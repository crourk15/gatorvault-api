import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <PublicSiteShell marketing>{children}</PublicSiteShell>;
}

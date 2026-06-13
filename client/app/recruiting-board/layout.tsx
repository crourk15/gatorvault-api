import React from 'react';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

export default function RecruitingBoardLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}

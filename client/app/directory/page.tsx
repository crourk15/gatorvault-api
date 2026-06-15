'use client';

import React from 'react';
import { PlayerDirectoryPage } from '@/components/site/PlayerDirectoryPage';
import { PublicSiteShell } from '@/components/site/PublicSiteShell';

export default function DirectoryRoute(): React.ReactElement {
  return (
    <PublicSiteShell>
      <PlayerDirectoryPage />
    </PublicSiteShell>
  );
}

'use client';

import React from 'react';
import { PortalList } from '@/components/vault/recruiting/RecruitingPortalSection';

export function VaultPortalDirectoryPage(): React.ReactElement {
  return (
    <div className="gv-portal-directory gv-page-layout gv-page-layout--navy" data-testid="vault-portal">
      <PortalList />
    </div>
  );
}

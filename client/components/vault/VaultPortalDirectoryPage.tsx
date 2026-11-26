'use client';

import React from 'react';
import { PortalList } from '@/components/vault/recruiting/RecruitingPortalSection';

export function VaultPortalDirectoryPage(): React.ReactElement {
  return (
    <div className="gv-portal-directory gv-page-layout gv-page-layout--navy" data-testid="vault-portal">
      <div className="gv-page-hero">
        <h1 className="gv-page-title gv-h1">Portal</h1>
        <p className="gv-page-subtitle">
          NCAA football window January 4–13, 2027. 10–12 difference makers. Names land when they
          are verified.
        </p>
      </div>
      <PortalList />
    </div>
  );
}

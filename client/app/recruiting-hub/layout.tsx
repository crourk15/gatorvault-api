import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import '@/lib/gv-design-system.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-home.css';
import '@/lib/vault-recruiting-hub.css';
import '@/styles/recruiting-hub-tokens.css';
import '@/styles/recruiting-hub-globals.css';
import '@/styles/recruiting-hub-command.css';

export default function RecruitingHubLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <VaultErrorBoundary>
      <VaultShell>{children}</VaultShell>
    </VaultErrorBoundary>
  );
}

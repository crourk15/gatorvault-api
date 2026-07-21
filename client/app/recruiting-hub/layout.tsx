import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import '@/lib/vault-shell.css';
import '@/lib/vault-home.css';
import '@/lib/vault-recruiting-hub.css';
import '@/styles/recruiting-hub-globals.css';
import '@/styles/recruiting-hub-command.css';
import '@/styles/hub-unified-theme.css';
import '@/lib/recruiting-hub-elite.css';
import '@/lib/recruiting-hub-command-center.css';
import '@/lib/vault-mobile-vertical.css';
import '@/lib/uf-premium-mobile.css';

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

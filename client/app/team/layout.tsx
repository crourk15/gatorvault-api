import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import '@/lib/gatorvault-brand.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-dashboard.css';
import '@/lib/vault-team-hub.css';

export default function TeamLayout({
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

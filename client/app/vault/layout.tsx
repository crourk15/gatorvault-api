import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import { VaultRouteGate } from '@/components/VaultRouteGate';
import '@/lib/gv-design-system.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-dashboard.css';
import '@/lib/vault-recruiting-hub.css';
import '@/lib/recruiting-hub-premium.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/vault-team-hub.css';
import '@/lib/gv-team.css';
import '@/lib/media-card.css';

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <VaultErrorBoundary>
      <VaultRouteGate />
      <VaultShell>{children}</VaultShell>
    </VaultErrorBoundary>
  );
}

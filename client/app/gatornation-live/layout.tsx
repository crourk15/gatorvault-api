import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import '@/lib/gv-design-system.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-home.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/gnl-hero.css';
import '@/lib/media-card.css';
import '@/lib/uf-premium-mobile.css';

export default function GatorNationLiveLayout({
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

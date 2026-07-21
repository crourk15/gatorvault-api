import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import '@/lib/vault-shell.css';
import '@/lib/vault-home.css';
import '@/lib/home-premium.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/gnl-hero.css';
import '@/lib/media-card.css';
import '@/lib/uf-premium-mobile.css';
import '@/lib/uf-premium-gnl.css';

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

import React from 'react';
import type { Viewport } from 'next';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import { VaultRouteGate } from '@/components/VaultRouteGate';
import '@/lib/gv-design-system.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-admin.css';
import '@/lib/vault-dashboard.css';
import '@/lib/vault-recruiting-hub.css';
import '@/lib/recruiting-hub-premium.css';
import '@/lib/headliner-card.css';
import '@/lib/schedule-premium.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/gnl-hero.css';
import '@/lib/vault-podcast-episode.css';
import '@/lib/player-directory-premium.css';
import '@/lib/vault-team-hub.css';
import '@/lib/gv-team.css';
import '@/lib/media-card.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const vaultShellCriticalCss =
  '.gv-vault-shell{min-height:100vh;min-height:100dvh;background:#060f1f;color:#e2e8f0;display:flex;flex-direction:column}.gv-vault-shell__main{flex:1;min-height:0;width:100%}';

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: vaultShellCriticalCss }} />
      <VaultErrorBoundary>
        <VaultRouteGate />
        <VaultShell>{children}</VaultShell>
      </VaultErrorBoundary>
    </>
  );
}

import React from 'react';
import type { Viewport } from 'next';
import { VaultShell } from '@/components/vault/VaultShell';
import { VaultErrorBoundary } from '@/components/vault/VaultErrorBoundary';
import { VaultNavigationProvider } from '@/components/vault/VaultNavigationProvider';
import { VaultRouteGate } from '@/components/VaultRouteGate';
import { VaultHydrationGuard } from '@/components/vault/VaultHydrationGuard';
import {
  VAULT_HYDRATION_BOOT_SCRIPT,
  VAULT_HYDRATION_CRITICAL_CSS,
} from '@/lib/vault-hydration-guard.js';
import '@/styles/index.css';
import '@/lib/gv-design-system.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/gv-page-layout.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-admin.css';
import '@/lib/vault-home.css';
import '@/lib/vault-recruiting-hub.css';
import '@/styles/recruiting-hub-tokens.css';
import '@/styles/recruiting-hub-globals.css';
import '@/styles/recruiting-hub-command.css';
import '@/lib/headliner-card.css';
import '@/lib/schedule-premium.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/gnl-hero.css';
import '@/lib/vault-podcast-episode.css';
import '@/lib/player-directory-premium.css';
import '@/lib/vault-team-hub.css';
import '@/lib/gv-team.css';
import '@/lib/media-card.css';
import '@/lib/gv-ui-cleanup.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const vaultShellCriticalCss =
  '.gv-vault-shell{min-height:100vh;min-height:100dvh;background:#001a33;color:#ffffff;display:flex;flex-direction:column}.gv-vault-shell__main{flex:1;min-height:0;width:100%}.gv-vault-shell--home .gv-vault-shell__body,.gv-vault-shell__main:has(.gv-home){margin:0;padding-top:0}.gv-vault-shell--home .gv-vault-shell__main,.gv-vault-shell__main:has(.gv-home){padding:0}.gv-home__frame,.gv-home__frame.gv-home__command{padding-top:24px}';

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `${vaultShellCriticalCss}${VAULT_HYDRATION_CRITICAL_CSS}`,
        }}
      />
      <script
        data-gv-hydration-boot=""
        dangerouslySetInnerHTML={{ __html: VAULT_HYDRATION_BOOT_SCRIPT }}
      />
      <div id="gv-vault-root" data-hydrating="true">
        <VaultHydrationGuard />
        <VaultErrorBoundary>
          <VaultRouteGate />
          <VaultNavigationProvider>
            <VaultShell>{children}</VaultShell>
          </VaultNavigationProvider>
        </VaultErrorBoundary>
      </div>
    </>
  );
}

import React from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AppRouteGate } from '@/components/shell/AppRouteGate';
import '@/lib/app-shell.css';
import '@/lib/vault-home.css';
import '@/lib/vault-recruiting-hub.css';
import '@/styles/recruiting-hub-globals.css';
import '@/styles/recruiting-hub-command.css';
import '@/lib/schedule-premium.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/vault-team-hub.css';
import '@/lib/futurecast-elite.css';
import '@/lib/gv-page-layout.css';
import '@/lib/vault-shell.css';
import '@/lib/vault-chase-card.css';
import '@/lib/gv-ui-cleanup.css';
import '@/styles/hub-unified-theme.css';
import '@/lib/recruiting-hub-elite.css';
import '@/lib/recruiting-hub-command-center.css';
import '@/lib/futurecast-lab-command-center.css';
import '@/lib/futurecast-premium.css';
import '@/lib/team-premium.css';
import '@/lib/nil-elite.css';
import '@/lib/vault-mobile-vertical.css';
import '@/lib/uf-premium-mobile.css';
import '@/lib/uf-premium-gnl.css';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      <AppRouteGate />
      <AppShell>{children}</AppShell>
    </>
  );
}

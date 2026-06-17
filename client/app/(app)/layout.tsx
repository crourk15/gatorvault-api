import React from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { AppRouteGate } from '@/components/shell/AppRouteGate';
import '@/lib/app-shell.css';
import '@/lib/gv-design-system.css';
import '@/lib/gatorvault-brand.css';
import '@/lib/vault-dashboard.css';
import '@/lib/vault-recruiting-hub.css';
import '@/styles/recruiting-hub-globals.css';
import '@/styles/recruiting-hub-command.css';
import '@/lib/schedule-premium.css';
import '@/lib/vault-gatornation-live.css';
import '@/lib/vault-team-hub.css';
import '@/lib/futurecast-elite.css';
import '@/lib/gv-page-layout.css';
import '@/lib/vault-shell.css';
import '@/lib/gv-ui-cleanup.css';

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

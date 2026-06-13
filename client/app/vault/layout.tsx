import React from 'react';
import { VaultShell } from '@/components/vault/VaultShell';
import '@/lib/vault-shell.css';

export default function VaultLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return <VaultShell>{children}</VaultShell>;
}

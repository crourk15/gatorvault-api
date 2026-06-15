'use client';

import React from 'react';
import '@/lib/vault-admin.css';

/** Full admin hub embedded inside the vault shell. */
export function VaultAdminConsolePage(): React.ReactElement {
  return (
    <div className="gv-vault-admin" data-testid="vault-admin-page">
      <header className="gv-vault-admin__header">
        <h1 className="gv-vault-admin__title">Admin Console</h1>
        <p className="gv-vault-admin__sub">
          Ops tools, recruiting admin, monitoring, and self-runner — PIN required inside the console.
        </p>
      </header>
      <iframe
        src="/admin.html"
        title="GatorVault Admin Console"
        className="gv-vault-admin__frame"
        data-testid="vault-admin-iframe"
      />
    </div>
  );
}

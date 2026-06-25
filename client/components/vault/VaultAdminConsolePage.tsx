'use client';

import React, { useEffect } from 'react';

/** Redirect vault /admin route to unified Admin Hub command center. */
export function VaultAdminConsolePage(): React.ReactElement {
  useEffect(() => {
    window.location.replace('/admin/hub');
  }, []);

  return (
    <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
      Redirecting to Admin Hub…
    </div>
  );
}

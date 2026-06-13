'use client';

import React, { useEffect } from 'react';

/** /vault — open monolith vault dashboard. */
export default function VaultIndexPage(): React.ReactElement {
  useEffect(() => {
    window.location.replace('/?open=vault&tab=start');
  }, []);

  return (
    <div className="gv-page">
      <p className="gv-page-status">Opening the Vault…</p>
    </div>
  );
}

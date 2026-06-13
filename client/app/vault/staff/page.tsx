'use client';

import React, { useEffect } from 'react';

/** /vault/staff → staff movement dashboard lives under FutureCast. */
export default function VaultStaffRedirectPage(): React.ReactElement {
  useEffect(() => {
    window.location.replace('/vault/futurecast/staff');
  }, []);

  return <p className="gv-page-status">Opening Staff Dashboard…</p>;
}

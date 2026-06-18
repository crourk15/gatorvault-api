'use client';

import { useEffect } from 'react';

/** Client redirect for retired FutureCast subpages → unified Lab section anchors. */
export function FutureCastSectionRedirect({ href }: { href: string }) {
  useEffect(() => {
    window.location.replace(href);
  }, [href]);
  return null;
}

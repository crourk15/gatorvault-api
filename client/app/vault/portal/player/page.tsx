'use client';

import React, { useEffect, useState } from 'react';
import { PortalProfilePage } from '@/components/portal/PortalProfilePage';

function slugFromPathname(): string {
  if (typeof window === 'undefined') return '';
  const match = window.location.pathname.match(/\/vault\/portal\/player\/([^/]+)\/?$/);
  return match ? decodeURIComponent(match[1]) : '';
}

export default function VaultPortalPlayerPage(): React.ReactElement {
  const [slug, setSlug] = useState('');

  useEffect(() => {
    setSlug(slugFromPathname());
  }, []);

  if (!slug) {
    return <p className="gv-page-status">Loading profile…</p>;
  }

  return <PortalProfilePage slug={slug} />;
}

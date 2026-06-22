import React from 'react';
import { ACTIVE_RECRUITING_CLASS_YEAR } from '@/lib/recruiting-cycle';

const HERO_YEAR = ACTIVE_RECRUITING_CLASS_YEAR;

/** Preconnect + preload for recruiting hub — same-origin API proxy in production. */
export function RecruitingHubHeadLinks(): React.ReactElement {
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE || '').replace(/\/$/, '');
  const bundlePath = `/api/recruiting/hub/bundle?year=${HERO_YEAR}`;
  const heroPath = `/api/recruiting/hub/hero?year=${HERO_YEAR}`;

  return (
    <>
      {apiBase ? <link rel="preconnect" href={apiBase} crossOrigin="anonymous" /> : null}
      <link rel="preload" href={heroPath} as="fetch" crossOrigin="anonymous" />
      <link rel="preload" href={bundlePath} as="fetch" crossOrigin="anonymous" />
    </>
  );
}

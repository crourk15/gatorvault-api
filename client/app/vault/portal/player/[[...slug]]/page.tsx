import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import PortalPlayerClient from '../PortalPlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function VaultPortalPlayerPage(): React.ReactElement {
  return <PortalPlayerClient />;
}

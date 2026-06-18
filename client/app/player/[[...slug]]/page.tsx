import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import StandalonePlayerClient from '../StandalonePlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function PlayerBySlugPage(): React.ReactElement {
  return <StandalonePlayerClient />;
}

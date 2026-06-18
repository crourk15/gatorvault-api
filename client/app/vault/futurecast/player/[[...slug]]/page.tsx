import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import FutureCastPlayerClient from '../FutureCastPlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function VaultFutureCastPlayerPage(): React.ReactElement {
  return <FutureCastPlayerClient />;
}

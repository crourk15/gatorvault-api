import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import AppFutureCastPlayerClient from '../AppFutureCastPlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function FutureCastPlayerPage(): React.ReactElement {
  return <AppFutureCastPlayerClient />;
}

import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import AppTeamPlayerClient from '../AppTeamPlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function TeamPlayerPage(): React.ReactElement {
  return <AppTeamPlayerClient />;
}

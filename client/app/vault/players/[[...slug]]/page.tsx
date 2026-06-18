import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import VaultPlayersClient from '../VaultPlayersClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function VaultPlayersPage(): React.ReactElement {
  return <VaultPlayersClient />;
}

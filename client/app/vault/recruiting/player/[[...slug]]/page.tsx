import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import RecruitingPlayerClient from '../RecruitingPlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function VaultRecruitingPlayerPage(): React.ReactElement {
  return <RecruitingPlayerClient />;
}

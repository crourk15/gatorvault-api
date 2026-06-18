import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import AppRecruitingPlayerClient from '../AppRecruitingPlayerClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function RecruitingPlayerPage(): React.ReactElement {
  return <AppRecruitingPlayerClient />;
}

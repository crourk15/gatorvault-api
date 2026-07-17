import React from 'react';
import { catchAllStaticParams } from '@/lib/static-export-catch-all';
import VaultArticlesClient from '../VaultArticlesClient';

export function generateStaticParams(): { slug: string[] }[] {
  return catchAllStaticParams();
}

export default function VaultArticlesCatchAllPage(): React.ReactElement {
  return <VaultArticlesClient />;
}

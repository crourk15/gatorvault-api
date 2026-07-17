'use client';

import React from 'react';
import { InsiderArticlesPage } from '@/components/insider-hub/InsiderArticlesPage';

export function VaultArticlesPage({
  initialArticleId,
}: {
  initialArticleId?: string;
} = {}): React.ReactElement {
  return <InsiderArticlesPage initialArticleId={initialArticleId} inVault />;
}

export default VaultArticlesPage;

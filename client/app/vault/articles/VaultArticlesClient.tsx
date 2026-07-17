'use client';

import React, { useMemo } from 'react';
import { ArticleReader } from '@/components/articles/ArticleReader';
import { VaultArticlesPage } from '@/components/vault/VaultArticlesPage';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { usePathname } from '@/lib/use-pathname';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

export default function VaultArticlesClient(): React.ReactElement {
  const pathname = usePathname();
  const articleId = useMemo(() => {
    const id = segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.vaultArticle);
    return id && id.toLowerCase() !== 'index.html' ? id : '';
  }, [pathname]);

  if (articleId) {
    return (
      <ArticleReader
        articleId={articleId}
        listHref={VAULT_PILLAR_ROUTES.articles}
        listLabel='<- All articles'
      />
    );
  }

  return <VaultArticlesPage />;
}

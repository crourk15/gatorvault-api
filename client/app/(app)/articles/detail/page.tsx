'use client';

import React, { useMemo } from 'react';
import { VaultArticlesPage } from '@/components/vault/VaultArticlesPage';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { usePathname } from '@/lib/use-pathname';

/** Article detail — `/articles/:articleId` via static rewrite. */
export default function ArticleDetailPage(): React.ReactElement {
  const pathname = usePathname();
  const articleId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.article),
    [pathname]
  );

  return <VaultArticlesPage initialArticleId={articleId || undefined} />;
}

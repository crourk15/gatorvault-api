'use client';

import React, { useMemo } from 'react';
import { ArticleReader } from '@/components/articles/ArticleReader';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { usePathname } from '@/lib/use-pathname';
import { UiError } from '@/components/site/UiMessage';
import { SITE_ROUTES } from '@/lib/site-routes';

/** Article detail — `/articles/:articleId` via static rewrite. */
export default function ArticleDetailPage(): React.ReactElement {
  const pathname = usePathname();
  const articleId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.article),
    [pathname]
  );

  if (!articleId) {
    return (
      <div className="rh-page rh-page--elite gv-page" style={{ padding: '2rem 1rem' }}>
        <UiError
          title="Missing article"
          message="No article id in this URL."
          backHref={SITE_ROUTES.articles}
          backLabel="← All articles"
        />
      </div>
    );
  }

  return <ArticleReader articleId={articleId} />;
}
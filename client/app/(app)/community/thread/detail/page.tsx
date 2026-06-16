'use client';

import React, { useMemo } from 'react';
import { DetailPageStub } from '@/components/shell/DetailPageStub';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

export default function CommunityThreadPage(): React.ReactElement {
  const pathname = usePathname();
  const threadId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.communityThread),
    [pathname]
  );

  if (!threadId) {
    return (
      <DetailPageStub
        title="Thread not found"
        id="—"
        idLabel="Thread ID"
        backHref={SITE_ROUTES.community}
        backLabel="← Community"
      />
    );
  }

  return (
    <DetailPageStub
      title="Community Thread"
      id={threadId}
      idLabel="Thread"
      backHref={SITE_ROUTES.community}
      backLabel="← Community"
    >
      <p style={{ color: '#94a3b8' }}>Thread posts load from the community API when wired.</p>
    </DetailPageStub>
  );
}

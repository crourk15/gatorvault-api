'use client';

import React, { useMemo } from 'react';
import { VaultCommunityPage } from '@/components/vault/VaultCommunityPage';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { usePathname } from '@/lib/use-pathname';

export default function CommunityThreadPage(): React.ReactElement {
  const pathname = usePathname();
  const threadId = useMemo(
    () => segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.communityThread),
    [pathname]
  );

  return <VaultCommunityPage threadId={threadId || undefined} />;
}

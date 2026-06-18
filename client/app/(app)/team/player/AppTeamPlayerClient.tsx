'use client';

import React, { useMemo } from 'react';
import { VaultPlayerProfileRoute } from '@/components/vault/VaultPlayerProfileRoute';
import { UiError } from '@/components/site/UiMessage';
import { DYNAMIC_PATH_PATTERNS, segmentFromPath } from '@/lib/dynamic-path-parser';
import { SITE_ROUTES } from '@/lib/site-routes';
import { usePathname } from '@/lib/use-pathname';

export default function AppTeamPlayerClient(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () =>
      segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.teamPlayer) ||
      segmentFromPath(pathname, DYNAMIC_PATH_PATTERNS.vaultTeamPlayer),
    [pathname]
  );

  if (!slug) {
    return (
      <UiError
        title="Player not found"
        message="No player slug in this URL."
        backHref={SITE_ROUTES.team}
        backLabel="← Team"
      />
    );
  }

  return (
    <VaultPlayerProfileRoute
      slug={slug}
      context="roster"
      backHref={SITE_ROUTES.team}
      backLabel="← Team"
    />
  );
}

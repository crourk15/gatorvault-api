'use client';

import React, { useMemo } from 'react';
import { PortalProfilePage } from '@/components/portal/PortalProfilePage';
import { UiError } from '@/components/site/UiMessage';
import { PLAYER_SLUG_PATTERNS, playerSlugFromPath } from '@/lib/player-slug-from-path';
import { usePathname } from '@/lib/use-pathname';
import { vaultPortalBackHref, vaultPortalBackLabel } from '@/lib/vault-routes';

export default function VaultPortalPlayerPage(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () => playerSlugFromPath(pathname, PLAYER_SLUG_PATTERNS.portal),
    [pathname]
  );

  if (!slug) {
    return (
      <UiError
        title="Player not found"
        message="No player slug in this URL."
        backHref={vaultPortalBackHref(pathname)}
        backLabel={vaultPortalBackLabel(pathname)}
      />
    );
  }

  return <PortalProfilePage slug={slug} />;
}

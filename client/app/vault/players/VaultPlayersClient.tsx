'use client';

import React, { useMemo } from 'react';
import { VaultPlayerProfileRoute } from '@/components/vault/VaultPlayerProfileRoute';
import { PlayerDirectoryPage } from '@/components/site/PlayerDirectoryPage';
import { UiError } from '@/components/site/UiMessage';
import { PLAYER_SLUG_PATTERNS, playerSlugFromPath } from '@/lib/player-slug-from-path';
import { usePathname } from '@/lib/use-pathname';
import { vaultTeamBackHref } from '@/lib/vault-navigation';

export default function VaultPlayersClient(): React.ReactElement {
  const pathname = usePathname();
  const slug = useMemo(
    () => playerSlugFromPath(pathname, PLAYER_SLUG_PATTERNS.roster),
    [pathname]
  );

  if (!slug) {
    return <PlayerDirectoryPage inVault />;
  }

  return (
    <VaultPlayerProfileRoute
      slug={slug}
      context="roster"
      backHref={vaultTeamBackHref()}
      backLabel="← Team"
    />
  );
}

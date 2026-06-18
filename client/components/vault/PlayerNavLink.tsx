'use client';

import React from 'react';
import { VaultNavLink } from '@/components/vault/VaultNavLink';

type Props = Omit<React.ComponentProps<typeof VaultNavLink>, 'prefetchOnTouch'>;

/** Player profile link — VaultNavLink + route/bundle prefetch on hover/touch. */
export function PlayerNavLink(props: Props): React.ReactElement {
  return <VaultNavLink prefetchOnTouch {...props} />;
}

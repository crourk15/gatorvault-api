'use client';

import React from 'react';
import { GatorNationLivePage } from '@/components/vault/live/GatorNationLivePage';

/** Static shell for Menu → Podcasts (`/vault/live/podcasts/`). */
export default function VaultLivePodcastsRoute(): React.ReactElement {
  return <GatorNationLivePage focusSection="podcasts" />;
}

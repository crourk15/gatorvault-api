'use client';

import React from 'react';
import { GatorNationLivePage } from '@/components/vault/live/GatorNationLivePage';

/** Static shell for Live Feed beat deep link. */
export default function VaultLiveBeatRoute(): React.ReactElement {
  return <GatorNationLivePage focusSection="beat" />;
}

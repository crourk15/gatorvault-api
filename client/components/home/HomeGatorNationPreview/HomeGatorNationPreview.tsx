'use client';

import React from 'react';
import type { HomeGnlItem } from '@/lib/vault-home-api';
import { HomeGnlPreview } from '@/components/home/premium/HomeGnlPreview';

type Props = {
  items: HomeGnlItem[];
};

/** @deprecated Use HomeGnlPreview on UF Premium home. */
export function HomeGatorNationPreview({ items }: Props): React.ReactElement {
  return <HomeGnlPreview items={items} />;
}

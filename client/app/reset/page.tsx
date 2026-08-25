'use client';

import React from 'react';
import { JoinPage } from '@/components/site/JoinPage';

/** Browser-only password setup / reset — not in iOS AASA, so email links stay in Safari. */
export default function ResetRoute(): React.ReactElement {
  return <JoinPage />;
}
